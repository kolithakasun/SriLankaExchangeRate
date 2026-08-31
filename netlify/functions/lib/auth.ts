import type { HandlerEvent } from "@netlify/functions";
import { getAnonClient, getServiceClient } from "./supabase-clients.js";

export type AppRole = "user" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  role: AppRole;
  disabled: boolean;
}

function bearerToken(event: HandlerEvent): string | null {
  const header =
    event.headers.authorization ||
    event.headers.Authorization ||
    event.headers["Authorization"];
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function requireUser(
  event: HandlerEvent,
): Promise<{ user: AuthUser } | { error: string; statusCode: number }> {
  const token = bearerToken(event);
  if (!token) {
    return { error: "Authentication required", statusCode: 401 };
  }

  const anon = getAnonClient();
  if (!anon) {
    return { error: "Auth is not configured", statusCode: 503 };
  }

  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) {
    return { error: "Invalid or expired session", statusCode: 401 };
  }

  const service = getServiceClient();
  if (!service) {
    return { error: "Auth is not configured", statusCode: 503 };
  }

  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("id, email, role, disabled")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Profile lookup failed", profileError.message);
    return { error: "Could not load profile", statusCode: 500 };
  }

  if (!profile) {
    return { error: "Profile not found", statusCode: 403 };
  }

  if (profile.disabled) {
    return { error: "Account disabled", statusCode: 403 };
  }

  return {
    user: {
      id: profile.id as string,
      email: (profile.email as string) || data.user.email || "",
      role: (profile.role as AppRole) ?? "user",
      disabled: Boolean(profile.disabled),
    },
  };
}

export async function requireAdmin(
  event: HandlerEvent,
): Promise<{ user: AuthUser } | { error: string; statusCode: number }> {
  const auth = await requireUser(event);
  if ("error" in auth) return auth;
  if (auth.user.role !== "admin") {
    return { error: "Admin access required", statusCode: 403 };
  }
  return auth;
}
