import { useCallback, useEffect, useState } from "react";
import type { ForecastResponse } from "@shared/types";
import { fetchForecast } from "../services/api";

export function useForecast(currency: string, bank?: string) {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchForecast({
        currency,
        bank,
        window: 7,
        horizon: 3,
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [bank, currency]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}
