import { formatInTimeZone } from "date-fns-tz";
import { formatDistanceToNowStrict, parseISO } from "date-fns";

export const COLOMBO_TZ = "Asia/Colombo";

export function nowIso(): string {
  return new Date().toISOString();
}

export function toColombo(iso: string | null | undefined, pattern = "d MMM yyyy h:mm a"): string {
  if (!iso) return "—";
  try {
    return formatInTimeZone(parseISO(iso), COLOMBO_TZ, pattern);
  } catch {
    return "—";
  }
}

export function toColomboTime(iso: string | null | undefined): string {
  return toColombo(iso, "h:mm a");
}

export function toColomboDate(iso: string | null | undefined): string {
  return toColombo(iso, "d MMM yyyy");
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  try {
    return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true });
  } catch {
    return "unknown";
  }
}

/** Parse common Sri Lankan bank date strings into UTC ISO when possible. */
export function parseSourceTimestamp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;

  // Already ISO-ish
  const isoTry = Date.parse(text);
  if (!Number.isNaN(isoTry) && /\d{4}-\d{2}-\d{2}/.test(text)) {
    return new Date(isoTry).toISOString();
  }

  // 14.08.2026 05:50:04 PM
  const dmy = text.match(
    /(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i,
  );
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    let hour = dmy[4] ? Number(dmy[4]) : 12;
    const minute = dmy[5] ? Number(dmy[5]) : 0;
    const second = dmy[6] ? Number(dmy[6]) : 0;
    const ampm = dmy[7]?.toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    // Interpret as Colombo local, convert to UTC
    const asUtc = Date.parse(
      `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}+05:30`,
    );
    if (!Number.isNaN(asUtc)) return new Date(asUtc).toISOString();
  }

  // Friday, August 14 2026, 08:10:32 AM
  const long = Date.parse(text.replace(",", ""));
  if (!Number.isNaN(long)) {
    // Assume Colombo if no timezone present
    if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)) {
      const d = new Date(long);
      // date-fns parse without TZ treats as local machine; rebuild with +05:30 fields
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const day = d.getDate();
      const h = d.getHours();
      const min = d.getMinutes();
      const s = d.getSeconds();
      const asUtc = Date.parse(
        `${y}-${pad(m)}-${pad(day)}T${pad(h)}:${pad(min)}:${pad(s)}+05:30`,
      );
      if (!Number.isNaN(asUtc)) return new Date(asUtc).toISOString();
    }
    return new Date(long).toISOString();
  }

  // 2026-08-14 only
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return new Date(`${dateOnly[0]}T12:00:00+05:30`).toISOString();
  }

  return null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function colomboDateKey(iso: string | Date = new Date()): string {
  return formatInTimeZone(iso, COLOMBO_TZ, "yyyy-MM-dd");
}
