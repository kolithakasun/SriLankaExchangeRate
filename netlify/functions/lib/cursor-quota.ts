import { createHash } from "node:crypto";
import type { ForecastResult } from "../../../shared/types.js";
import { colomboDateKey, nowIso } from "../../../shared/utils/time.js";
import { getServiceClient } from "./supabase-clients.js";

export const CURSOR_DAILY_LIMIT = 2;

export type CursorRunStatus =
  | "reserved"
  | "pending"
  | "completed"
  | "failed"
  | "released";

export interface CursorForecastRun {
  id: string;
  quotaDate: string;
  slot: number;
  inputHash: string;
  bankCode: string;
  currencyCode: string;
  forecastRange: string;
  status: CursorRunStatus;
  agentId: string | null;
  runId: string | null;
  narration: string | null;
  error: string | null;
  requestedBy: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface CursorQuotaStatus {
  date: string;
  used: number;
  limit: number;
  remaining: number;
  resetAt: string;
}

function mapRun(row: Record<string, unknown>): CursorForecastRun {
  return {
    id: row.id as string,
    quotaDate: row.quota_date as string,
    slot: Number(row.slot),
    inputHash: row.input_hash as string,
    bankCode: row.bank_code as string,
    currencyCode: row.currency_code as string,
    forecastRange: row.forecast_range as string,
    status: row.status as CursorRunStatus,
    agentId: (row.agent_id as string | null) ?? null,
    runId: (row.run_id as string | null) ?? null,
    narration: (row.narration as string | null) ?? null,
    error: (row.error as string | null) ?? null,
    requestedBy: (row.requested_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    completedAt: (row.completed_at as string | null) ?? null,
  };
}

/** Stable hash of the numeric forecast the narration is grounded on. */
export function hashForecastInput(options: {
  bank: string;
  currency: string;
  range: string;
  forecast: ForecastResult;
}): string {
  const payload = {
    bank: options.bank,
    currency: options.currency,
    range: options.range,
    daysCovered: options.forecast.daysCovered,
    confidence: options.forecast.confidence,
    trend: options.forecast.trend,
    assumptions: options.forecast.assumptions ?? null,
    bestDayOfWeek: options.forecast.bestDayOfWeek,
    worstDayOfWeek: options.forecast.worstDayOfWeek,
    references: options.forecast.references
      ? {
          combinedSignal: options.forecast.references.combinedSignal,
          comparisons: options.forecast.references.comparisons,
          cbsl: options.forecast.references.cbsl
            ? {
                latestDate: options.forecast.references.cbsl.latestDate,
                latestBuying: options.forecast.references.cbsl.latestBuying,
                latestSelling: options.forecast.references.cbsl.latestSelling,
                trend: options.forecast.references.cbsl.trend,
              }
            : null,
          google: options.forecast.references.google
            ? {
                latestDate: options.forecast.references.google.latestDate,
                latestBuying: options.forecast.references.google.latestBuying,
                trend: options.forecast.references.google.trend,
              }
            : null,
        }
      : null,
    dailyTail: options.forecast.daily.slice(-5).map((d) => ({
      date: d.date,
      avgBuying: d.avgBuying,
      avgSelling: d.avgSelling,
    })),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/** Next Colombo midnight as an ISO timestamp. */
export function nextColomboMidnightIso(fromIso?: string): string {
  const today = colomboDateKey(fromIso);
  const [y, m, d] = today.split("-").map(Number);
  // Colombo has no DST; next local midnight is +05:30 from that calendar day+1 UTC date.
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1));
  const yyyy = nextDay.getUTCFullYear();
  const mm = String(nextDay.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(nextDay.getUTCDate()).padStart(2, "0");
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00+05:30`).toISOString();
}

export async function getCursorQuotaStatus(
  date = colomboDateKey(),
): Promise<CursorQuotaStatus> {
  const client = getServiceClient();
  let used = 0;
  if (client) {
    const { count, error } = await client
      .from("cursor_forecast_runs")
      .select("id", { count: "exact", head: true })
      .eq("quota_date", date)
      .neq("status", "released");
    if (error) {
      console.error("Cursor quota count failed", error.message);
    } else {
      used = count ?? 0;
    }
  }
  return {
    date,
    used,
    limit: CURSOR_DAILY_LIMIT,
    remaining: Math.max(CURSOR_DAILY_LIMIT - used, 0),
    resetAt: nextColomboMidnightIso(),
  };
}

export async function findCompletedCursorNarration(
  inputHash: string,
): Promise<CursorForecastRun | null> {
  const client = getServiceClient();
  if (!client) return null;

  const { data, error } = await client
    .from("cursor_forecast_runs")
    .select("*")
    .eq("input_hash", inputHash)
    .eq("status", "completed")
    .not("narration", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Cursor cache lookup failed", error.message);
    return null;
  }
  return data ? mapRun(data) : null;
}

/**
 * Latest completed Cursor narration for quota-exhausted reuse.
 * Prefers the same bank/currency/range when provided, then same bank/currency,
 * then any recent completed run (any Colombo day).
 */
export async function findLatestCompletedCursorNarration(options?: {
  bank?: string;
  currency?: string;
  range?: string;
}): Promise<CursorForecastRun | null> {
  const client = getServiceClient();
  if (!client) return null;

  const attempts: Array<{
    bank?: string;
    currency?: string;
    range?: string;
  }> = [];
  if (options?.bank && options?.currency && options?.range) {
    attempts.push({
      bank: options.bank,
      currency: options.currency,
      range: options.range,
    });
  }
  if (options?.bank && options?.currency) {
    attempts.push({ bank: options.bank, currency: options.currency });
  }
  attempts.push({});

  for (const filter of attempts) {
    let query = client
      .from("cursor_forecast_runs")
      .select("*")
      .eq("status", "completed")
      .not("narration", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1);
    if (filter.bank) query = query.eq("bank_code", filter.bank);
    if (filter.currency) query = query.eq("currency_code", filter.currency);
    if (filter.range) query = query.eq("forecast_range", filter.range);

    const { data, error } = await query.maybeSingle();
    if (error) {
      console.error("Latest Cursor narration lookup failed", error.message);
      return null;
    }
    if (data) return mapRun(data);
  }

  return null;
}

export async function claimCursorQuotaSlot(options: {
  inputHash: string;
  bank: string;
  currency: string;
  range: string;
  requestedBy: string;
}): Promise<{ run: CursorForecastRun } | { exhausted: true }> {
  const client = getServiceClient();
  if (!client) {
    throw new Error("Supabase is required for Cursor quota");
  }

  const date = colomboDateKey();
  const { data, error } = await client.rpc("claim_cursor_quota_slot", {
    p_quota_date: date,
    p_input_hash: options.inputHash,
    p_bank_code: options.bank,
    p_currency_code: options.currency,
    p_forecast_range: options.range,
    p_requested_by: options.requestedBy,
  });

  if (error) {
    // Unique violation can still surface if an old claim function is deployed;
    // treat it as exhausted rather than a 500.
    if (/cursor_forecast_runs_day_slot|duplicate key/i.test(error.message)) {
      console.warn("Cursor quota claim hit unique constraint; treating as exhausted");
      return { exhausted: true };
    }
    throw new Error(`Could not claim Cursor quota: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.run_id) {
    return { exhausted: true };
  }

  const { data: run, error: loadError } = await client
    .from("cursor_forecast_runs")
    .select("*")
    .eq("id", row.run_id)
    .single();

  if (loadError || !run) {
    throw new Error(loadError?.message ?? "Claimed Cursor run missing");
  }

  return { run: mapRun(run) };
}

export async function releaseCursorQuotaSlot(runId: string): Promise<void> {
  const client = getServiceClient();
  if (!client) return;
  const { error } = await client.rpc("release_cursor_quota_slot", {
    p_run_id: runId,
  });
  if (error) {
    console.error("Cursor quota release failed", error.message);
  }
}

export async function markCursorRunPending(
  runId: string,
  agentId: string,
  cursorRunId: string,
): Promise<void> {
  const client = getServiceClient();
  if (!client) return;
  const { error } = await client
    .from("cursor_forecast_runs")
    .update({
      status: "pending",
      agent_id: agentId,
      run_id: cursorRunId,
      updated_at: nowIso(),
    })
    .eq("id", runId);
  if (error) console.error("markCursorRunPending failed", error.message);
}

export async function completeCursorRun(
  runId: string,
  narration: string,
): Promise<void> {
  const client = getServiceClient();
  if (!client) return;
  const now = nowIso();
  const { error } = await client
    .from("cursor_forecast_runs")
    .update({
      status: "completed",
      narration,
      error: null,
      updated_at: now,
      completed_at: now,
    })
    .eq("id", runId);
  if (error) console.error("completeCursorRun failed", error.message);
}

export async function failCursorRun(
  runId: string,
  message: string,
): Promise<void> {
  const client = getServiceClient();
  if (!client) return;
  const now = nowIso();
  const { error } = await client
    .from("cursor_forecast_runs")
    .update({
      status: "failed",
      error: message,
      updated_at: now,
      completed_at: now,
    })
    .eq("id", runId);
  if (error) console.error("failCursorRun failed", error.message);
}

export async function getCursorRunById(
  runId: string,
): Promise<CursorForecastRun | null> {
  const client = getServiceClient();
  if (!client) return null;
  const { data, error } = await client
    .from("cursor_forecast_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  if (error) {
    console.error("getCursorRunById failed", error.message);
    return null;
  }
  return data ? mapRun(data) : null;
}
