import type { Handler } from "@netlify/functions";
import { getClientIp, json, wrap } from "./lib/http.js";

const SUBJECTS = [
  "General inquiry",
  "Bug report",
  "Feature request",
  "Rate data issue",
  "Partnership",
  "Other",
] as const;

type ContactSubject = (typeof SUBJECTS)[number];

interface ContactBody {
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message?: string;
  website?: string; // honeypot
}

const contactHits = new Map<string, number>();
const COOLDOWN_MS = 60_000;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function trimField(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

async function sendWithWeb3Forms(params: {
  accessKey: string;
  to: string;
  name: string;
  email: string;
  phone: string;
  subject: ContactSubject;
  message: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      access_key: params.accessKey,
      subject: `[Contact] ${params.subject}`,
      from_name: params.name,
      email: params.email,
      replyto: params.email,
      to: params.to,
      phone: params.phone || "Not provided",
      message: [
        `Subject: ${params.subject}`,
        `Name: ${params.name}`,
        `Email: ${params.email}`,
        `Phone: ${params.phone || "Not provided"}`,
        "",
        params.message,
      ].join("\n"),
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
  };

  if (!res.ok || data.success === false) {
    return {
      ok: false,
      error: data.message || `Mail API failed (${res.status})`,
    };
  }
  return { ok: true };
}

async function sendWithResend(params: {
  apiKey: string;
  to: string;
  from: string;
  name: string;
  email: string;
  phone: string;
  subject: ContactSubject;
  message: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      reply_to: params.email,
      subject: `[Contact] ${params.subject}`,
      text: [
        `Subject: ${params.subject}`,
        `Name: ${params.name}`,
        `Email: ${params.email}`,
        `Phone: ${params.phone || "Not provided"}`,
        "",
        params.message,
      ].join("\n"),
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    error?: { message?: string };
  };

  if (!res.ok) {
    return {
      ok: false,
      error:
        data.error?.message || data.message || `Mail API failed (${res.status})`,
    };
  }
  return { ok: true };
}

const handler: Handler = wrap(async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const contactEmail = process.env.CONTACT_EMAIL?.trim();
  const web3Key = process.env.WEB3FORMS_ACCESS_KEY?.trim();
  const resendKey = process.env.RESEND_API_KEY?.trim();

  if (!contactEmail) {
    return json(503, {
      error: "Contact form is not configured (CONTACT_EMAIL missing)",
    });
  }
  if (!web3Key && !resendKey) {
    return json(503, {
      error:
        "Contact form is not configured (set WEB3FORMS_ACCESS_KEY or RESEND_API_KEY)",
    });
  }

  const ip = getClientIp(event);
  const last = contactHits.get(ip) ?? 0;
  const now = Date.now();
  if (now - last < COOLDOWN_MS) {
    return json(429, {
      error: "Please wait a minute before sending another message",
    });
  }

  let body: ContactBody;
  try {
    body = JSON.parse(event.body || "{}") as ContactBody;
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  // Honeypot — bots fill hidden fields; humans leave them empty.
  if (trimField(body.website, 200)) {
    contactHits.set(ip, now);
    return json(200, { ok: true });
  }

  const name = trimField(body.name, 120);
  const email = trimField(body.email, 200);
  const phone = trimField(body.phone, 40);
  const subject = trimField(body.subject, 80) as ContactSubject;
  const message = trimField(body.message, 4000);

  if (!name || !email || !subject || !message) {
    return json(400, { error: "Name, email, subject, and message are required" });
  }
  if (!isValidEmail(email)) {
    return json(400, { error: "Please enter a valid email address" });
  }
  if (!SUBJECTS.includes(subject)) {
    return json(400, { error: "Please choose a valid subject" });
  }

  const from =
    process.env.CONTACT_FROM_EMAIL?.trim() ||
    "Sri Lanka Exchange Rates <onboarding@exchangeratelk.com>";

  const result = web3Key
    ? await sendWithWeb3Forms({
        accessKey: web3Key,
        to: contactEmail,
        name,
        email,
        phone,
        subject,
        message,
      })
    : await sendWithResend({
        apiKey: resendKey!,
        to: contactEmail,
        from,
        name,
        email,
        phone,
        subject,
        message,
      });

  if (!result.ok) {
    console.error("Contact mail failed:", result.error);
    return json(502, { error: "Could not send your message. Please try again." });
  }

  contactHits.set(ip, now);
  return json(200, { ok: true });
});

export { handler };
export const CONTACT_SUBJECTS = SUBJECTS;
