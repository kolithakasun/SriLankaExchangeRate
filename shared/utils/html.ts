import * as cheerio from "cheerio";
import { supportedCurrencyCodes } from "../config/currencies.js";
import type { ExchangeRate } from "../types.js";
import { parseRateNumber } from "./rates.js";
import { nowIso, parseSourceTimestamp } from "./time.js";

const CURRENCY_ALIASES: Record<string, string> = {
  USD: "USD",
  "US DOLLAR": "USD",
  "US DOLLARS": "USD",
  "U.S. DOLLAR": "USD",
  "UNITED STATES DOLLAR": "USD",
  AUD: "AUD",
  "AUSTRALIAN DOLLAR": "AUD",
  "AUSTRALIAN DOLLARS": "AUD",
  EUR: "EUR",
  EURO: "EUR",
  EUROS: "EUR",
  JPY: "JPY",
  YEN: "JPY",
  "JAPANESE YEN": "JPY",
  SGD: "SGD",
  "SINGAPORE DOLLAR": "SGD",
  "SINGAPORE DOLLARS": "SGD",
};

export function normalizeCurrencyLabel(raw: string): string | null {
  const cleaned = raw
    .replace(/\s+/g, " ")
    .replace(/\(.*?\)/g, "")
    .trim()
    .toUpperCase();
  if (!cleaned) return null;
  if (CURRENCY_ALIASES[cleaned]) return CURRENCY_ALIASES[cleaned];

  const codeMatch = cleaned.match(/\b([A-Z]{3})\b/);
  if (codeMatch && supportedCurrencyCodes.includes(codeMatch[1])) {
    return codeMatch[1];
  }
  return null;
}

function headerScore(text: string): {
  isTt: boolean;
  isBuying: boolean;
  isSelling: boolean;
} {
  const t = text.toLowerCase().replace(/\s+/g, " ");
  const isTt =
    t.includes("telegraphic") ||
    /\btt\b/.test(t) ||
    t.includes("t.t") ||
    t.includes("pfca") ||
    t.includes("bfca");
  const isBuying = t.includes("buy");
  const isSelling = t.includes("sell");
  return { isTt, isBuying, isSelling };
}

/**
 * Locate TT buying/selling column indexes from expanded header labels
 * (one string per visual column, colspan already expanded).
 */
export function findTtColumnIndexes(
  headerRows: string[][],
): { buy: number; sell: number } | null {
  const colCount = Math.max(0, ...headerRows.map((r) => r.length));
  if (!colCount) return null;

  const combined: string[] = Array.from({ length: colCount }, () => "");
  for (const row of headerRows) {
    row.forEach((cell, i) => {
      combined[i] = `${combined[i]} ${cell}`.trim();
    });
  }

  // Strategy 1: column itself says TT + buying/selling
  let buy = -1;
  let sell = -1;
  combined.forEach((text, i) => {
    const s = headerScore(text);
    if (s.isTt && s.isBuying) buy = i;
    if (s.isTt && s.isSelling) sell = i;
  });
  if (buy >= 0 && sell >= 0) return { buy, sell };

  // Strategy 2: TT group header columns — take the last TT-labelled buy/sell pair
  // (banks usually place Telegraphic Transfers after Notes/Drafts).
  const ttBuys: number[] = [];
  const ttSells: number[] = [];
  combined.forEach((text, i) => {
    const s = headerScore(text);
    if (!s.isTt) return;
    if (s.isBuying) ttBuys.push(i);
    if (s.isSelling) ttSells.push(i);
  });
  if (ttBuys.length && ttSells.length) {
    return {
      buy: ttBuys[ttBuys.length - 1],
      sell: ttSells[ttSells.length - 1],
    };
  }

  // Strategy 3: last buying/selling pair overall
  const buys: number[] = [];
  const sells: number[] = [];
  combined.forEach((text, i) => {
    const s = headerScore(text);
    if (s.isBuying) buys.push(i);
    if (s.isSelling) sells.push(i);
  });
  if (buys.length && sells.length) {
    return { buy: buys[buys.length - 1], sell: sells[sells.length - 1] };
  }

  return null;
}

/** Expand th/td cells so colspan aligns with data columns. */
export function expandRowCells($: cheerio.CheerioAPI, row: unknown): string[] {
  const cells: string[] = [];
  const $row = $(row as never);
  $row.children("th,td").each((_, cell) => {
    const $cell = $(cell);
    const text = $cell.text().replace(/\s+/g, " ").trim();
    const span = Math.max(1, Number($cell.attr("colspan") ?? 1) || 1);
    for (let i = 0; i < span; i += 1) cells.push(text);
  });
  return cells;
}

export function extractSourceTimestampFromHtml(html: string): string | null {
  const patterns = [
    /as\s*at[:\s]*([0-9].{5,40})/i,
    /last\s*updated(?:\s*on)?[:\s]*([0-9].{5,40})/i,
    /rate:\s*rupees[^0-9]*([0-9]{4}-[0-9]{2}-[0-9]{2})/i,
    /effective(?:\s*from)?[:\s]*([0-9].{5,40})/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) {
      const parsed = parseSourceTimestamp(m[1]);
      if (parsed) return parsed;
      // date-only fallback
      const d = m[1].match(/\d{4}-\d{2}-\d{2}/);
      if (d) return parseSourceTimestamp(d[0]);
    }
  }
  return null;
}

export interface HtmlTableParseOptions {
  bankCode: string;
  html: string;
  currencies?: string[];
  parserVersion: string;
  /** Force TT column indexes if header detection fails */
  fallbackTtColumns?: { buy: number; sell: number };
  /** When true, use fallbackTtColumns even if detection succeeds */
  preferFallback?: boolean;
  currencyColumnIndexes?: number[];
}

export function parseTtRatesFromHtmlTables(
  options: HtmlTableParseOptions,
): { rates: ExchangeRate[]; sourceTimestamp: string | null } {
  const {
    bankCode,
    html,
    currencies = supportedCurrencyCodes,
    parserVersion,
    fallbackTtColumns,
    preferFallback = false,
    currencyColumnIndexes = [0, 1],
  } = options;

  const $ = cheerio.load(html);
  const retrievedAt = nowIso();
  const sourceTimestamp = extractSourceTimestampFromHtml(html);
  const rates: ExchangeRate[] = [];
  const seen = new Set<string>();

  $("table").each((_, table) => {
    const $table = $(table);
    const tableText = $table.text().toLowerCase();
    const looksLikeFxTable =
      tableText.includes("telegraphic") ||
      tableText.includes("tt buying") ||
      tableText.includes("tt selling") ||
      (tableText.includes("buying") &&
        tableText.includes("selling") &&
        /usd|us dollar|euro|yen/i.test(tableText));
    if (!looksLikeFxTable) return;

    const headerRows: string[][] = [];

    $table.find("tr").each((__, tr) => {
      const $tr = $(tr);
      // Header rows are th-only (or th-dominant without numeric rate cells)
      if ($tr.find("th").length === 0) return;
      if ($tr.find("td").length > 0) return;
      const headers = expandRowCells($, tr);
      if (!headers.length) return;
      // Drop leading empty columns created by spacer <th> cells
      while (headers.length && !headers[0]) headers.shift();
      if (!headers.length) return;
      // Skip banner/title rows
      const unique = new Set(headers.filter(Boolean));
      if (unique.size <= 2 && headers.length > 4) {
        const joined = [...unique].join(" ").toLowerCase();
        if (
          joined.includes("exchange rates") ||
          joined.includes("as at") ||
          joined.includes("rupees per unit")
        ) {
          return;
        }
      }
      if (unique.size <= 1 && headers.length > 3) return;
      headerRows.push(headers);
    });

    const detected = preferFallback ? null : findTtColumnIndexes(headerRows);
    const headerWidth = Math.max(0, ...headerRows.map((r) => r.length));
    if (!detected && !fallbackTtColumns) return;

    $table.find("tr").each((__, tr) => {
      const $tr = $(tr);
      const tdCells = $tr
        .find("td")
        .map((___, td) => $(td).text().replace(/\s+/g, " ").trim())
        .get();
      if (!tdCells.length) return;

      // People's Bank puts currency labels in <th> beside rate <td>s.
      const thLabels = $tr
        .find("th")
        .map((___, th) => $(th).text().replace(/\s+/g, " ").trim())
        .get()
        .filter(Boolean);
      const cells =
        thLabels.length && !normalizeCurrencyLabel(tdCells[0] ?? "")
          ? [...thLabels, ...tdCells]
          : tdCells;

      let buyIdx: number;
      let sellIdx: number;
      if (detected) {
        buyIdx = detected.buy;
        sellIdx = detected.sell;
        // Leading currency-name column not present in the rate header grid
        if (
          headerWidth > 0 &&
          cells.length === headerWidth + 1 &&
          normalizeCurrencyLabel(cells[0])
        ) {
          buyIdx += 1;
          sellIdx += 1;
        }
      } else {
        buyIdx = fallbackTtColumns!.buy;
        sellIdx = fallbackTtColumns!.sell;
      }

      if (cells.length < Math.max(buyIdx, sellIdx) + 1) return;

      let currency: string | null = null;
      for (const idx of currencyColumnIndexes) {
        if (cells[idx]) {
          currency = normalizeCurrencyLabel(cells[idx]);
          if (currency) break;
        }
      }
      // Also scan early cells
      if (!currency) {
        for (let i = 0; i < Math.min(3, cells.length); i++) {
          currency = normalizeCurrencyLabel(cells[i]);
          if (currency) break;
        }
      }
      if (!currency || !currencies.includes(currency)) return;
      if (seen.has(currency)) return;

      const ttBuying = parseRateNumber(cells[buyIdx]);
      const ttSelling = parseRateNumber(cells[sellIdx]);
      if (ttBuying === null && ttSelling === null) return;

      seen.add(currency);
      rates.push({
        bankCode,
        currency,
        ttBuying,
        ttSelling,
        sourceTimestamp,
        retrievedAt,
        parserVersion,
      });
    });
  });

  return { rates, sourceTimestamp };
}

export async function fetchText(
  url: string,
  init: RequestInit = {},
): Promise<string> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; SLExchangeRates/1.0; +https://github.com/)",
      Accept: "text/html,application/xhtml+xml,application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return res.text();
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const text = await fetchText(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  return JSON.parse(text) as T;
}
