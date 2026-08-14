import type { Handler, HandlerEvent, HandlerResponse } from "@netlify/functions";

const refreshHits = new Map<string, number>();

export function json(
  statusCode: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): HandlerResponse {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-refresh-token",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

export function handleOptions(): HandlerResponse {
  return json(204, {});
}

export function getClientIp(event: HandlerEvent): string {
  return (
    event.headers["x-nf-client-connection-ip"] ||
    event.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    event.headers["client-ip"] ||
    "unknown"
  );
}

export function checkRefreshAllowed(event: HandlerEvent): {
  ok: boolean;
  reason?: string;
} {
  const required = process.env.REFRESH_TOKEN;
  if (required) {
    const provided = event.headers["x-refresh-token"];
    if (provided !== required) {
      return { ok: false, reason: "Unauthorized refresh token" };
    }
  }

  const cooldown = Number(process.env.REFRESH_COOLDOWN_SECONDS ?? 60);
  const ip = getClientIp(event);
  const last = refreshHits.get(ip) ?? 0;
  const now = Date.now();
  if (now - last < cooldown * 1000) {
    return {
      ok: false,
      reason: `Please wait ${cooldown}s between refresh requests`,
    };
  }
  refreshHits.set(ip, now);
  return { ok: true };
}

export function wrap(handler: Handler): Handler {
  return async (event, context) => {
    if (event.httpMethod === "OPTIONS") return handleOptions();
    try {
      return await handler(event, context);
    } catch (err) {
      console.error(err);
      return json(500, {
        error: "Internal server error",
      });
    }
  };
}
