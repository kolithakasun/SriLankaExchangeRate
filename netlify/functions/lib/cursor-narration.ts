import { Agent, CursorAgentError } from "@cursor/sdk";
import type { ForecastResult } from "../../../shared/types.js";
import { buildPrompt } from "./ai.js";
import {
  completeCursorRun,
  failCursorRun,
  getCursorRunById,
  markCursorRunPending,
  releaseCursorQuotaSlot,
  type CursorForecastRun,
} from "./cursor-quota.js";

const DEFAULT_REPO =
  "https://github.com/kolithakasun/SriLankaExchangeRate.git";
const DEFAULT_REF = "main";

function cursorApiKey(): string | null {
  const key = process.env.CURSOR_API_KEY?.trim();
  return key || null;
}

function cursorModelId(): string {
  return process.env.CURSOR_MODEL?.trim() || "auto";
}

function repoUrl(): string {
  return process.env.CURSOR_REPO_URL?.trim() || DEFAULT_REPO;
}

function repoRef(): string {
  return process.env.CURSOR_REPO_REF?.trim() || DEFAULT_REF;
}

export function isCursorConfigured(): boolean {
  return Boolean(cursorApiKey());
}

/**
 * Starts a Cursor cloud agent for narration. On startup failure before a run
 * exists, the reserved quota slot is released. The cloud agent outlives this
 * request — callers poll reconcileCursorRun for the final text.
 */
export async function launchCursorNarration(options: {
  reservedRunId: string;
  forecast: ForecastResult;
  bank: string;
  currency: string;
  rangeLabel: string;
}): Promise<{ agentId: string; runId: string } | { error: string }> {
  const apiKey = cursorApiKey();
  if (!apiKey) {
    await releaseCursorQuotaSlot(options.reservedRunId);
    return { error: "CURSOR_API_KEY is not configured" };
  }

  const prompt = buildPrompt(options.forecast, {
    bank: options.bank,
    currency: options.currency,
    rangeLabel: options.rangeLabel,
  });

  try {
    // Do not await-using: disposing the local handle must not cancel the cloud job.
    const agent = await Agent.create({
      apiKey,
      model: { id: cursorModelId() },
      cloud: {
        repos: [{ url: repoUrl(), startingRef: repoRef() }],
        autoCreatePR: false,
        skipReviewerRequest: true,
      },
    });

    const run = await agent.send(
      `${prompt}\n\nRespond with only the 2-3 sentence summary. Do not edit files or open a pull request.`,
    );

    await markCursorRunPending(
      options.reservedRunId,
      agent.agentId,
      run.id,
    );

    return { agentId: agent.agentId, runId: run.id };
  } catch (err) {
    const message =
      err instanceof CursorAgentError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    console.error("Cursor launch failed", message);
    await releaseCursorQuotaSlot(options.reservedRunId);
    return { error: message };
  }
}

/**
 * Polls Cursor for a pending run and updates the DB when finished.
 * Credits are kept even if the run fails after it started.
 */
export async function reconcileCursorRun(
  run: CursorForecastRun,
): Promise<CursorForecastRun> {
  if (
    run.status === "completed" ||
    run.status === "failed" ||
    run.status === "released"
  ) {
    return run;
  }
  if (!run.agentId || !run.runId) {
    return run;
  }

  const apiKey = cursorApiKey();
  if (!apiKey) return run;

  try {
    const cursorRun = await Agent.getRun(run.runId, {
      runtime: "cloud",
      agentId: run.agentId,
      apiKey,
    });

    // Prefer conversation/status without blocking forever if wait hangs.
    if (cursorRun.supports("wait")) {
      const result = await Promise.race([
        cursorRun.wait(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 12_000)),
      ]);
      if (!result) {
        // Still running — leave pending for the next poll.
        return run;
      }
      if (result.status === "finished" && result.result?.trim()) {
        await completeCursorRun(run.id, result.result.trim());
      } else if (result.status === "finished") {
        await failCursorRun(run.id, "Cursor finished without narration text");
      } else if (result.status === "error" || result.status === "cancelled") {
        await failCursorRun(
          run.id,
          result.error?.message ?? `Cursor run ${result.status}`,
        );
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Cursor reconcile failed", message);
    if (/timeout|network|ECONN|fetch failed|still running/i.test(message)) {
      return run;
    }
    await failCursorRun(run.id, message);
  }

  return (await getCursorRunById(run.id)) ?? run;
}
