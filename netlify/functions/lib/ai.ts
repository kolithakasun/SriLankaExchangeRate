import type { ForecastResult } from "../../../shared/types.js";
import { weekdayName } from "../../../shared/utils/forecast.js";

const GEMINI_MODEL = "gemini-flash-lite-latest";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const AI_TIMEOUT_MS = 8000;

type NarrationSource = "gemini" | "groq" | "template";

function templateNarration(
  forecast: ForecastResult,
  context: { bank: string; currency: string },
): string {
  return forecast.suggestedAction.replace(
    "TT buying rate",
    `${context.currency}/LKR TT buying rate at ${context.bank}`,
  );
}

function buildPrompt(
  forecast: ForecastResult,
  context: { bank: string; currency: string },
): string {
  return `You are summarizing a currency exchange rate forecast for a Sri Lankan bank rate comparison site.
Bank: ${context.bank}, Currency: ${context.currency}/LKR.
Days of history analyzed: ${forecast.daysCovered} (confidence: ${forecast.confidence}).
Trend: ${forecast.trend ? `${forecast.trend.direction}, ${forecast.trend.pctChangePerDay}% per day, projected next-day TT buying ${forecast.trend.projectedNextDayBuying}` : "not enough data yet"}.
Best day of week historically (TT buying): ${forecast.bestDayOfWeek ? `${weekdayName(forecast.bestDayOfWeek.weekday)} (avg ${forecast.bestDayOfWeek.avgBuying})` : "not enough data yet"}.

Write a 2-3 sentence, plain-English summary for a non-technical reader, grounded strictly in the numbers above. Do not invent data points, do not give financial advice beyond what the numbers support, and do not mention that you are an AI.`;
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
  source: Exclude<NarrationSource, "template">;
  envKey: string;
  run: (prompt: string, apiKey: string) => Promise<string | null>;
}> = [
  { source: "gemini", envKey: "GEMINI_API_KEY", run: geminiNarration },
  { source: "groq", envKey: "GROQ_API_KEY", run: groqNarration },
];

export function getAvailableProviders(): Array<Exclude<NarrationSource, "template">> {
  return PROVIDERS.filter((p) => Boolean(process.env[p.envKey])).map((p) => p.source);
}

export async function narrateForecast(
  forecast: ForecastResult,
  context: { bank: string; currency: string },
  options?: { requestedProvider?: string },
): Promise<{ text: string; source: NarrationSource }> {
  const requested = options?.requestedProvider?.toLowerCase();
  const forced =
    requested && requested !== "auto" ? requested : process.env.AI_PROVIDER?.toLowerCase();
  const candidates = forced ? PROVIDERS.filter((p) => p.source === forced) : PROVIDERS;

  const prompt = buildPrompt(forecast, context);

  for (const provider of candidates) {
    const apiKey = process.env[provider.envKey];
    if (!apiKey) continue;
    const text = await provider.run(prompt, apiKey);
    if (text) return { text, source: provider.source };
  }

  return { text: templateNarration(forecast, context), source: "template" };
}
