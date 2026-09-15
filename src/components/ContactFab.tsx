import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { submitContact } from "../services/api";

const SUBJECTS = [
  "General inquiry",
  "Bug report",
  "Feature request",
  "Rate data issue",
  "Partnership",
  "Other",
] as const;

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  subject: "" as "" | (typeof SUBJECTS)[number],
  message: "",
  website: "",
};

export function ContactFab() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstFieldRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setError(null);
    if (sent) {
      setSent(false);
      setForm(emptyForm);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (!form.subject) {
        throw new Error("Please choose a subject");
      }
      await submitContact({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        subject: form.subject,
        message: form.message,
        website: form.website,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setSent(false);
          setError(null);
        }}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/15 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] sm:bottom-6 sm:right-6"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
          />
        </svg>
        Contact us
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2
                  id={titleId}
                  className="text-xl font-extrabold tracking-tight"
                >
                  Contact us
                </h2>
                <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                  Send a message and we will get back to you by email.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-lg border border-[var(--color-line)] px-2.5 py-1 text-sm font-semibold"
                aria-label="Close contact form"
              >
                ✕
              </button>
            </div>

            {sent ? (
              <div className="space-y-4">
                <p className="rounded-lg bg-[var(--color-accent-soft)] px-3 py-2 text-sm text-[var(--color-accent)]">
                  Thanks — your message was sent. We will reply to{" "}
                  <span className="font-semibold">{form.email}</span>.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--color-ink-muted)]">
                    Name
                  </span>
                  <input
                    ref={firstFieldRef}
                    type="text"
                    required
                    autoComplete="name"
                    maxLength={120}
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2"
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--color-ink-muted)]">
                    Email
                  </span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    maxLength={200}
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2"
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--color-ink-muted)]">
                    Phone number{" "}
                    <span className="opacity-70">(optional)</span>
                  </span>
                  <input
                    type="tel"
                    autoComplete="tel"
                    maxLength={40}
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2"
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--color-ink-muted)]">
                    Subject / reason
                  </span>
                  <select
                    required
                    value={form.subject}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        subject: e.target.value as typeof form.subject,
                      }))
                    }
                    className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2"
                  >
                    <option value="" disabled>
                      Select a reason
                    </option>
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--color-ink-muted)]">
                    Message
                  </span>
                  <textarea
                    required
                    rows={5}
                    maxLength={4000}
                    value={form.message}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, message: e.target.value }))
                    }
                    className="w-full resize-y rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2"
                  />
                </label>

                {/* Honeypot — hidden from users */}
                <label className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
                  Website
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, website: e.target.value }))
                    }
                  />
                </label>

                {error && (
                  <p className="rounded-lg bg-[var(--color-warn-soft)] px-3 py-2 text-sm text-[var(--color-warn)]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {submitting ? "Sending…" : "Send message"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
