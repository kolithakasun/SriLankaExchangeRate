import type { ForecastResult } from "../../../shared/types.js";
import { weekdayName } from "../../../shared/utils/forecast.js";

const GEMINI_MODEL = "gemini-flash-lite-latest";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const AI_TIMEOUT_MS = 8000;

export type NarrationSource = "gemini" | "groq" | "cursor" | "template";
export type SyncNarrationSource = Exclude<NarrationSource, "cursor">;

function templateNarration(
  forecast: ForecastResult,
  context: { bank: string; currency: string; rangeLabel?: string },
): string {
  const base = forecast.suggestedAction.replace(
    "TT buying rate",
    `${context.currency}/LKR TT buying rate at ${context.bank}`,
  );
  const extra = forecast.references?.combinedSignal;
  return extra ? `${base} ${extra}` : base;
}

function referencePromptBlock(forecast: ForecastResult): string {
  const refs = forecast.references;
  if (!refs) return "";

  const cbsl = refs.cbsl
    ? `CBSL official 9:30 TT (latest ${refs.cbsl.latestDate ?? "n/a"}): buy ${refs.cbsl.latestBuying ?? "n/a"}, sell ${refs.cbsl.latestSelling ?? "n/a"}; trend ${refs.cbsl.trend ? `${refs.cbsl.trend.direction} ${refs.cbsl.trend.pctChangePerDay}%/day` : "not enough CBSL history"}.`
    : `CBSL official TT unavailable${refs.errors.CBSL ? ` (${refs.errors.CBSL})` : ""}.`;
  const google = refs.google
    ? `Google Finance mid (latest ${refs.google.latestDate ?? "n/a"}): ${refs.google.latestBuying ?? "n/a"}; trend ${refs.google.trend ? `${refs.google.trend.direction} ${refs.google.trend.pctChangePerDay}%/day` : "not enough Google history"}.`
    : `Google mid unavailable${refs.errors.GOOGLE ? ` (${refs.errors.GOOGLE})` : ""}.`;
  const spreads = refs.comparisons
    .map((c) => {
      const buy = c.buyingSpread === null ? "n/a" : c.buyingSpread;
      const sell = c.sellingSpread === null ? "n/a" : c.sellingSpread;
      return `${c.label}: buying spread ${buy}, selling spread ${sell}, trend ${c.alignment}`;
    })
    .join("; ");

  return `Reference signal (use this to qualify the bank forecast, do not replace it):
${cbsl}
${google}
Bank vs references: ${spreads || "none"}.
Combined: ${refs.combinedSignal}`;
}

export function buildPrompt(
  forecast: ForecastResult,
  context: { bank: string; currency: string; rangeLabel?: string },
): string {
  return `You are summarizing a currency exchange rate forecast for a Sri Lankan bank rate comparison site.
Bank: ${context.bank}, Currency: ${context.currency}/LKR.
Lookback window: ${context.rangeLabel ?? "default"}. Days with data in that window: ${forecast.daysCovered} (confidence: ${forecast.confidence}).
Trend: ${forecast.trend ? `${forecast.trend.direction}, ${forecast.trend.pctChangePerDay}% per day, projected next-day TT buying ${forecast.trend.projectedNextDayBuying}` : "not enough data yet"}.
Best day of week historically (TT buying): ${forecast.bestDayOfWeek ? `${weekdayName(forecast.bestDayOfWeek.weekday)} (avg ${forecast.bestDayOfWeek.avgBuying})` : "not enough data yet"}.
${referencePromptBlock(forecast)}

Write a 2-3 sentence, plain-English summary for a non-technical reader, grounded strictly in the numbers above. If CBSL or Google references are present, mention how this bank compares (spread and whether the trend agrees). Do not invent data points, do not give financial advice beyond what the numbers support, and do not mention that you are an AI.`;
}

async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

async function geminiNarration(
  prompt: string,
  apiKey: string,
): Promise<string | null> {
  try {
    return await withTimeout(async (signal) => {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
          signal,
        },
      );

      if (!res.ok) {
        console.error("Gemini request failed", res.status, await res.text());
        return null;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return typeof text === "string" && text.trim() ? text.trim() : null;
    });
  } catch (err) {
    console.error("Gemini request error", err);
    return null;
  }
}

/** Groq: free tier, no billing card required — https://console.groq.com/keys */
async function groqNarration(
  prompt: string,
  apiKey: string,
): Promise<string | null> {
  try {
    return await withTimeout(async (signal) => {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
        }),
        signal,
      });

      if (!res.ok) {
        console.error("Groq request failed", res.status, await res.text());
        return null;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      return typeof text === "string" && text.trim() ? text.trim() : null;
    });
  } catch (err) {
    console.error("Groq request error", err);
    return null;
  }
}

const PROVIDERS: Array<{
  source: "gemini" | "groq";
  envKey: string;
  run: (prompt: string, apiKey: string) => Promise<string | null>;
}> = [
  { source: "gemini", envKey: "GEMINI_API_KEY", run: geminiNarration },
  { source: "groq", envKey: "GROQ_API_KEY", run: groqNarration },
];

/**
 * Sync providers only. Cursor is auth-gated and launched separately so it
 * never runs from anonymous GET /api/forecast or the 6-hour browser timer.
 */
export function getAvailableProviders(options?: {
  includeCursor?: boolean;
}): Array<"gemini" | "groq" | "cursor"> {
  const list: Array<"gemini" | "groq" | "cursor"> = PROVIDERS.filter((p) =>
    Boolean(process.env[p.envKey]),
  ).map((p) => p.source);
  if (options?.includeCursor && process.env.CURSOR_API_KEY?.trim()) {
    list.push("cursor");
  }
  return list;
}

export async function narrateForecast(
  forecast: ForecastResult,
  context: { bank: string; currency: string; rangeLabel?: string },
  options?: { requestedProvider?: string },
): Promise<{ text: string; source: SyncNarrationSource }> {
  const requested = options?.requestedProvider?.toLowerCase();
  // Cursor is never selected here — callers must use the dedicated async path.
  if (requested === "cursor") {
    return { text: templateNarration(forecast, context), source: "template" };
  }
  const forced =
    requested && requested !== "auto" ? requested : process.env.AI_PROVIDER?.toLowerCase();
  const candidates =
    forced && forced !== "cursor"
      ? PROVIDERS.filter((p) => p.source === forced)
      : PROVIDERS;

  const prompt = buildPrompt(forecast, context);

  for (const provider of candidates) {
    const apiKey = process.env[provider.envKey];
    if (!apiKey) continue;
    const text = await provider.run(prompt, apiKey);
    if (text) return { text, source: provider.source };
  }

  return { text: templateNarration(forecast, context), source: "template" };
}

export function templateForecastNarration(
  forecast: ForecastResult,
  context: { bank: string; currency: string; rangeLabel?: string },
): string {
  return templateNarration(forecast, context);
}
