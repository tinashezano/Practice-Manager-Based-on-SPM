import { appUrl } from "@/lib/app-url";
import { decrypt, encrypt } from "@/lib/crypto";
import { db } from "@/lib/db";

// Google Calendar + Gmail via REST (no SDK). Each staff member connects
// their own account once; we keep an encrypted refresh token.

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/gmail.send",
];

export function googleConfigured() {
  return !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;
}

const redirectUri = () => appUrl("/api/google/callback");

export function googleAuthUrl(state: string, loginHint?: string) {
  const params = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  if (loginHint) params.set("login_hint", loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.AUTH_GOOGLE_ID!, client_secret: process.env.AUTH_GOOGLE_SECRET!, ...body }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Google token error: ${json.error_description ?? json.error ?? res.status}`);
  return json as { access_token: string; expires_in: number; refresh_token?: string; scope: string; id_token?: string };
}

/** Completes the OAuth flow and stores the connection for this user. */
export async function connectGoogle(userId: string, code: string) {
  const tokens = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  if (!tokens.refresh_token) throw new Error("Google did not return a refresh token. Remove Outset PM's access in your Google account settings and try again.");
  const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } }).then((r) => r.json());
  const data = { googleEmail: String(info.email ?? ""), refreshTokenEncrypted: encrypt(tokens.refresh_token), scopes: tokens.scope };
  await db.googleConnection.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  accessTokens.delete(userId);
}

const accessTokens = new Map<string, { token: string; expires: number }>();

async function accessToken(userId: string) {
  const cached = accessTokens.get(userId);
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const conn = await db.googleConnection.findUnique({ where: { userId } });
  if (!conn) throw new Error("Google account not connected");
  const t = await tokenRequest({ refresh_token: decrypt(conn.refreshTokenEncrypted), grant_type: "refresh_token" });
  accessTokens.set(userId, { token: t.access_token, expires: Date.now() + t.expires_in * 1000 });
  return t.access_token;
}

export async function getConnection(userId: string) {
  return googleConfigured() ? db.googleConnection.findUnique({ where: { userId } }) : null;
}

async function api<T>(userId: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken(userId)}`, "Content-Type": "application/json", ...init.headers },
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google API ${res.status}: ${json.error?.message ?? res.statusText}`);
  return json as T;
}

const CAL = "https://www.googleapis.com/calendar/v3";

export async function freeBusy(userId: string, from: Date, to: Date) {
  const r = await api<{ calendars: Record<string, { busy: { start: string; end: string }[] }> }>(userId, `${CAL}/freeBusy`, {
    method: "POST",
    body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: "primary" }] }),
  });
  return (r.calendars.primary?.busy ?? []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

type EventInput = { summary: string; description: string; start: Date; end: Date; attendee: { email: string; name: string }; requestId: string };

/** Creates the event with a Google Meet link and invites the attendee. */
export async function createEvent(userId: string, e: EventInput) {
  const r = await api<{ id: string; hangoutLink?: string }>(userId, `${CAL}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`, {
    method: "POST",
    body: JSON.stringify({
      summary: e.summary,
      description: e.description,
      start: { dateTime: e.start.toISOString() },
      end: { dateTime: e.end.toISOString() },
      attendees: [{ email: e.attendee.email, displayName: e.attendee.name }],
      conferenceData: { createRequest: { requestId: e.requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } },
      reminders: { useDefault: true },
    }),
  });
  return { id: r.id, meetUrl: r.hangoutLink ?? null };
}

export async function moveEvent(userId: string, eventId: string, start: Date, end: Date) {
  await api(userId, `${CAL}/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: "PATCH",
    body: JSON.stringify({ start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } }),
  });
}

export async function cancelEvent(userId: string, eventId: string) {
  await api(userId, `${CAL}/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`, { method: "DELETE" });
}

export async function listEvents(userId: string, from: Date, to: Date) {
  const params = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "100" });
  const r = await api<{ items: { id: string; summary?: string; htmlLink: string; hangoutLink?: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string } }[] }>(
    userId,
    `${CAL}/calendars/primary/events?${params}`,
  );
  return r.items.map((i) => ({
    id: i.id,
    title: i.summary ?? "(no title)",
    link: i.htmlLink,
    meetUrl: i.hangoutLink ?? null,
    allDay: !i.start.dateTime,
    start: new Date(i.start.dateTime ?? `${i.start.date}T00:00:00+02:00`),
    end: new Date(i.end.dateTime ?? `${i.end.date}T00:00:00+02:00`),
  }));
}

function encodeHeader(v: string) {
  return /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v).toString("base64")}?=`;
}

/** Sends an email from the user's own Gmail mailbox (it appears in their Sent folder). */
export async function sendGmail(userId: string, m: { to: string; subject: string; html: string; text: string; fromName: string; fromEmail: string }) {
  const boundary = `b_${Date.now().toString(36)}`;
  const mime = [
    `From: ${encodeHeader(m.fromName)} <${m.fromEmail}>`,
    `To: ${m.to}`,
    `Subject: ${encodeHeader(m.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    m.text,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "",
    m.html,
    `--${boundary}--`,
  ].join("\r\n");
  await api(userId, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw: Buffer.from(mime).toString("base64url") }),
  });
}
