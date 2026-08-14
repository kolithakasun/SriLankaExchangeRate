import { relativeTime, toColombo } from "@shared/utils/time";
import type { LatestRateView } from "@shared/types";

export function StatusDot({ status }: { status: LatestRateView["status"] }) {
  const color =
    status === "ok"
      ? "bg-[var(--color-accent)]"
      : status === "stale"
        ? "bg-[var(--color-warn)]"
        : status === "error"
          ? "bg-[var(--color-danger)]"
          : "bg-[var(--color-ink-muted)]";
  return <span className={`inline-block size-2 rounded-full ${color}`} />;
}

export function BankStatusLine({ rate }: { rate: LatestRateView }) {
  const when = rate.lastSuccessAt || rate.retrievedAt;
  if (rate.status === "error" || rate.status === "stale") {
    return (
      <p className="mt-2 text-xs text-[var(--color-warn)] flex items-center gap-1.5">
        <StatusDot status={rate.status} />
        Last successful update {when ? relativeTime(when) : "unknown"}
        {rate.lastError ? ` · ${rate.lastError}` : ""}
      </p>
    );
  }
  return (
    <p className="mt-2 text-xs text-[var(--color-ink-muted)] flex items-center gap-1.5">
      <StatusDot status={rate.status} />
      Updated {when ? relativeTime(when) : "—"}
      {rate.sourceTimestamp ? ` · Source ${toColombo(rate.sourceTimestamp, "h:mm a")}` : ""}
    </p>
  );
}
