import { getEnabledCurrencies } from "@shared/config/currencies";

export function CurrencySelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const currencies = getEnabledCurrencies();

  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Currency">
      {currencies.map((c) => {
        const active = c.code === value;
        return (
          <button
            key={c.code}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(c.code)}
            className={`min-w-16 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              active
                ? "bg-[var(--color-accent)] text-white shadow-sm"
                : "bg-[var(--color-panel)] text-[var(--color-ink)] border border-[var(--color-line)] hover:border-[var(--color-accent)]"
            }`}
          >
            {c.code}
          </button>
        );
      })}
    </div>
  );
}
