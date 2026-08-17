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
  // Sized against the card width (see @container on BankRateCard) rather than the
  // viewport: a monospace rate at text-4xl overflows a narrow card's half-width column.
  const sizeClass =
    size === "lg"
      ? "text-2xl @min-[320px]:text-3xl @min-[440px]:text-4xl"
      : size === "sm"
        ? "text-base"
        : "text-xl @min-[320px]:text-2xl";

  return (
    <span
      className={`rate-num inline-flex max-w-full items-baseline gap-1 whitespace-nowrap ${sizeClass} font-semibold`}
    >
      {formatRate(value ?? null, currency)}
      {change === "up" && <span className="text-[var(--color-up)] text-sm">↑</span>}
      {change === "down" && <span className="text-[var(--color-down)] text-sm">↓</span>}
    </span>
  );
}
