import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ThemeToggle } from "../components/ThemeToggle";
import {
  createAdminUser,
  fetchAdminUsers,
  updateAdminUser,
  type AdminUser,
} from "../services/api";

export default function AdminUsers() {
  const { accessToken, profile, signOut } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminUsers(accessToken);
      setUsers(res.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setCreating(true);
    setError(null);
    try {
      await createAdminUser(accessToken, { email, password, role });
      setEmail("");
      setPassword("");
      setRole("user");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  async function toggleDisabled(user: AdminUser) {
    if (!accessToken) return;
    setError(null);
    try {
      await updateAdminUser(accessToken, {
        id: user.id,
        disabled: !user.disabled,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function setUserRole(user: AdminUser, next: "user" | "admin") {
    if (!accessToken) return;
    setError(null);
    try {
      await updateAdminUser(accessToken, { id: user.id, role: next });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            Admin
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Users</h1>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            Only admins can create accounts. Signed in as {profile?.email}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ThemeToggle />
          <Link
            to="/"
            className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm font-semibold"
          >
            Dashboard
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm font-semibold"
          >
            Sign out
          </button>
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-lg bg-[var(--color-warn-soft)] px-3 py-2 text-sm text-[var(--color-warn)]">
          {error}
        </p>
      )}

      <section className="mb-10 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-ink-muted)]">
          Add user
        </h2>
        <form
          onSubmit={onCreate}
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <label className="text-sm lg:col-span-1">
            <span className="mb-1 block text-[var(--color-ink-muted)]">
              Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-[var(--color-ink-muted)]">
              Temporary password
            </span>
            <input
              type="text"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-[var(--color-ink-muted)]">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "user" | "admin")}
              className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={creating}
              className="w-full rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--color-ink-muted)]">
          Accounts
        </h2>
        {loading ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--color-line)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--color-line)] bg-[var(--color-accent-soft)]/40 text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-[var(--color-line)] last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">{user.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={user.role}
                        onChange={(e) =>
                          void setUserRole(
                            user,
                            e.target.value as "user" | "admin",
                          )
                        }
                        className="rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-2 py-1"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {user.disabled ? "Disabled" : "Active"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void toggleDisabled(user)}
                        className="rounded-lg border border-[var(--color-line)] px-2.5 py-1 text-xs font-semibold"
                      >
                        {user.disabled ? "Enable" : "Disable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
