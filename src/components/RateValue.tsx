import { formatRate } from "@shared/utils/rates";

export function rateChange(
  current: number | null | undefined,
  previous: number | null | undefined,
): "up" | "down" | "same" | null {
  if (current == null || previous == null) return null;
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "same";
}

export function RateValue({
  value,
  currency,
  previous,
  size = "md",
}: {
  value: number | null | undefined;
  currency?: string;
  previous?: number | null;
  size?: "sm" | "md" | "lg";
}) {
  const change = rateChange(value ?? null, previous ?? null);
  const sizeClass =
    size === "lg" ? "text-3xl md:text-4xl" : size === "sm" ? "text-base" : "text-2xl";

  return (
    <span className={`rate-num inline-flex items-baseline gap-1 ${sizeClass} font-semibold`}>
      {formatRate(value ?? null, currency)}
      {change === "up" && <span className="text-[var(--color-up)] text-sm">↑</span>}
      {change === "down" && <span className="text-[var(--color-down)] text-sm">↓</span>}
    </span>
  );
}
