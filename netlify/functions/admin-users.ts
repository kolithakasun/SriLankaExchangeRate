import type { Handler } from "@netlify/functions";
import { requireAdmin } from "./lib/auth.js";
import { json, wrap } from "./lib/http.js";
import { getServiceClient } from "./lib/supabase-clients.js";

function parseBody(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const handler: Handler = wrap(async (event) => {
  const auth = await requireAdmin(event);
  if ("error" in auth) {
    return json(auth.statusCode, { error: auth.error });
  }

  const client = getServiceClient();
  if (!client) {
    return json(503, { error: "Supabase is not configured" });
  }

  if (event.httpMethod === "GET") {
    const { data: profiles, error } = await client
      .from("profiles")
      .select("id, email, role, disabled, created_at, updated_at")
      .order("created_at", { ascending: true });

    if (error) {
      return json(500, { error: error.message });
    }

    return json(200, { users: profiles ?? [] });
  }

  if (event.httpMethod === "POST") {
    const body = parseBody(event.body);
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");
    const role = body.role === "admin" ? "admin" : "user";

    if (!email || !password) {
      return json(400, { error: "email and password are required" });
    }
    if (password.length < 8) {
      return json(400, { error: "password must be at least 8 characters" });
    }

    const { data, error } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error || !data.user) {
      return json(400, { error: error?.message ?? "Could not create user" });
    }

    if (role === "admin") {
      const { error: roleError } = await client
        .from("profiles")
        .update({ role: "admin", updated_at: new Date().toISOString() })
        .eq("id", data.user.id);
      if (roleError) {
        return json(500, {
          error: `User created but role update failed: ${roleError.message}`,
        });
      }
    }

    const { data: profile } = await client
      .from("profiles")
      .select("id, email, role, disabled, created_at, updated_at")
      .eq("id", data.user.id)
      .maybeSingle();

    return json(201, { user: profile });
  }

  if (event.httpMethod === "PATCH") {
    const body = parseBody(event.body);
    const userId = String(body.id ?? "").trim();
    if (!userId) {
      return json(400, { error: "id is required" });
    }
    if (userId === auth.user.id && body.disabled === true) {
      return json(400, { error: "You cannot disable your own account" });
    }
    if (userId === auth.user.id && body.role && body.role !== "admin") {
      return json(400, { error: "You cannot demote your own admin role" });
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.role === "admin" || body.role === "user") {
      patch.role = body.role;
    }
    if (typeof body.disabled === "boolean") {
      patch.disabled = body.disabled;
    }

    const { data: profile, error } = await client
      .from("profiles")
      .update(patch)
      .eq("id", userId)
      .select("id, email, role, disabled, created_at, updated_at")
      .maybeSingle();

    if (error) {
      return json(500, { error: error.message });
    }
    if (!profile) {
      return json(404, { error: "User not found" });
    }

    if (typeof body.disabled === "boolean") {
      await client.auth.admin.updateUserById(userId, {
        ban_duration: body.disabled ? "876000h" : "none",
      });
    }

    return json(200, { user: profile });
  }

  return json(405, { error: "Method not allowed" });
});

export { handler };
