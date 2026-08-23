import * as cheerio from "cheerio";
import { supportedCurrencyCodes } from "../config/currencies.js";
import type { ExchangeRate, HistoryPoint } from "../types.js";
import { normalizeCurrencyLabel } from "./html.js";
import { parseRateNumber } from "./rates.js";

export const CBSL_TT_FORM_URL =
  "https://www.cbsl.gov.lk/cbsl_custom/exratestt/exratestt.php";
export const CBSL_TT_RESULTS_URL =
  "https://www.cbsl.gov.lk/cbsl_custom/exratestt/exrates_resultstt.php";
export const CBSL_CHART_BASE_URL =
  "https://www.cbsl.gov.lk/cbsl_custom/charts";

/** Form checkbox values for the official 9:30 a.m. TT buy/sell search. */
export const CBSL_TT_FORM_VALUES: Record<string, string> = {
  USD: "USD~United States Dollar",
  AUD: "AUD~Australian Dollar",
  EUR: "EUR~Euro",
  JPY: "JPY~Yen",
  SGD: "SGD~Singapore Dollar",
};

export interface CbslTtRow {
  currency: string;
  date: string;
  ttBuying: number | null;
  ttSelling: number | null;
}

function noonColomboIso(dateKey: string): string {
  return `${dateKey}T12:00:00+05:30`;
}

export function parseCbslTtResultsHtml(html: string): CbslTtRow[] {
  const $ = cheerio.load(html);
  const rows: CbslTtRow[] = [];

  $("h2").each((_, heading) => {
    const currency = normalizeCurrencyLabel($(heading).text());
    if (!currency || !supportedCurrencyCodes.includes(currency)) return;

    let table = $(heading).nextAll("table").first();
    if (!table.length) {
      table = $(heading).nextAll("div.table-responsive").find("table").first();
    }
    if (!table.length) return;

    table.find("tbody tr").each((__, tr) => {
      const cells = $(tr)
        .find("td")
        .map((___, td) => $(td).text().replace(/\s+/g, " ").trim())
        .get();
      if (cells.length < 3) return;
      const date = cells[0]?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      if (!date) return;
      rows.push({
        currency,
        date,
        ttBuying: parseRateNumber(cells[1]),
        ttSelling: parseRateNumber(cells[2]),
      });
    });
  });

  return rows;
}

export function parseCbslChartWidget(html: string): {
  indicative: number | null;
  buy: number | null;
  sell: number | null;
} {
  const text = html.replace(/&nbsp;/g, " ");
  const pick = (label: string): number | null => {
    const match = text.match(
      new RegExp(`${label}\\s*([0-9]+(?:\\.[0-9]+)?)`, "i"),
    );
    return parseRateNumber(match?.[1]);
  };
  return {
    indicative: pick("Indicative"),
    buy: pick("Buy"),
    sell: pick("Sell"),
  };
}

export function cbslRowsToHistory(
  rows: CbslTtRow[],
  retrievedAt: string,
): HistoryPoint[] {
  return rows
    .filter((row) => row.ttBuying !== null || row.ttSelling !== null)
    .map((row) => ({
      bankCode: "CBSL",
      currency: row.currency,
      ttBuying: row.ttBuying,
      ttSelling: row.ttSelling,
      sourceTimestamp: noonColomboIso(row.date),
      retrievedAt: noonColomboIso(row.date),
      createdAt: retrievedAt,
    }))
    .sort((a, b) => (a.retrievedAt < b.retrievedAt ? -1 : 1));
}

/** Latest published row per currency (CBSL skips weekends/holidays). */
export function latestCbslRates(
  rows: CbslTtRow[],
  retrievedAt: string,
  parserVersion: string,
): ExchangeRate[] {
  const newest = new Map<string, CbslTtRow>();
  for (const row of rows) {
    const current = newest.get(row.currency);
    if (!current || row.date > current.date) newest.set(row.currency, row);
  }

  return [...newest.values()].map((row) => ({
    bankCode: "CBSL",
    currency: row.currency,
    ttBuying: row.ttBuying,
    ttSelling: row.ttSelling,
    sourceTimestamp: noonColomboIso(row.date),
    retrievedAt,
    parserVersion,
    rawReference: "cbsl_custom/exratestt/exrates_resultstt.php",
  }));
}

export function cbslChartUrl(currency: string): string {
  return `${CBSL_CHART_BASE_URL}/${currency.toLowerCase()}/indexsmall.php`;
}
