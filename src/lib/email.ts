import { db } from "@/lib/db";
import { getConnection, googleConfigured, sendGmail } from "@/lib/google";
import { enqueue } from "@/lib/jobs";
import { notify } from "@/lib/notify";

type Outgoing = { to: string; subject: string; html: string; text: string; senderId: string | null; dealId?: string | null };

/** Records an email in the outbox and queues it for sending. */
export async function queueEmail(m: Outgoing) {
  const msg = await db.emailMessage.create({ data: { ...m, dealId: m.dealId ?? null } });
  await enqueue("email.send", { emailId: msg.id });
  return msg;
}

/**
 * Sends a queued email from the sender's own Gmail. If the sender hasn't
 * connected Google, the email is marked SKIPPED (not retried) and the sender
 * is told, so nothing silently disappears.
 */
export async function deliverEmail(emailId: string) {
  const msg = await db.emailMessage.findUnique({ where: { id: emailId } });
  if (!msg || msg.status !== "QUEUED") return;
  const sender = msg.senderId ? await db.user.findUnique({ where: { id: msg.senderId } }) : null;
  const conn = sender && googleConfigured() ? await getConnection(sender.id) : null;

  if (!sender || !conn || !conn.scopes.includes("gmail.send")) {
    const reason = !sender ? "No sender for this email" : "Sender hasn't connected Google (Booking Links → Connect Google)";
    await db.emailMessage.update({ where: { id: msg.id }, data: { status: "SKIPPED", error: reason } });
    if (msg.dealId) await db.dealActivity.create({ data: { dealId: msg.dealId, type: "EMAIL", body: `Email not sent: "${msg.subject}" to ${msg.to}. ${reason}.` } });
    if (sender) await notify([sender.id], "system", { title: `Email to ${msg.to} wasn't sent`, body: reason, link: msg.dealId ? `/deals/${msg.dealId}` : "/settings/automations" });
    return;
  }

  try {
    await sendGmail(sender.id, { to: msg.to, subject: msg.subject, html: msg.html, text: msg.text, fromName: sender.name, fromEmail: conn.googleEmail });
  } catch (err) {
    await db.emailMessage.update({ where: { id: msg.id }, data: { error: err instanceof Error ? err.message : String(err) } });
    throw err; // retried by the job queue
  }
  await db.emailMessage.update({ where: { id: msg.id }, data: { status: "SENT", sentAt: new Date(), error: null } });
  if (msg.dealId) await db.dealActivity.create({ data: { dealId: msg.dealId, type: "EMAIL", body: `Emailed "${msg.subject}" to ${msg.to}.`, actorId: sender.id } });
}

// ---------- Templates ----------

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(bodyHtml: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1b1f3b;max-width:560px">${bodyHtml}<p style="margin-top:28px;color:#6b7090;font-size:13px">Outset</p></div>`;
}

function button(href: string, label: string) {
  return `<p><a href="${esc(href)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${esc(label)}</a></p>`;
}

export function bookingInviteEmail(p: { contactName: string; senderName: string; linkTitle: string; url: string }) {
  const first = p.contactName.split(" ")[0];
  return {
    subject: `Book your ${p.linkTitle.toLowerCase()} with Outset`,
    html: layout(
      `<p>Hi ${esc(first!)},</p><p>Thank you for getting in touch with Outset. The next step is a short ${esc(p.linkTitle.toLowerCase())} so we can understand your business and how we can help.</p>${button(p.url, "Choose a time")}<p>Or copy this link: <a href="${esc(p.url)}">${esc(p.url)}</a></p><p>Kind regards,<br>${esc(p.senderName)}</p>`,
    ),
    text: `Hi ${first},\n\nThank you for getting in touch with Outset. The next step is a short ${p.linkTitle.toLowerCase()} so we can understand your business and how we can help.\n\nChoose a time: ${p.url}\n\nKind regards,\n${p.senderName}`,
  };
}

export function bookingConfirmationEmail(p: { name: string; title: string; when: string; hostName: string; meetUrl: string | null; manageUrl: string }) {
  const first = p.name.split(" ")[0];
  const meet = p.meetUrl ? `<p>Join with Google Meet: <a href="${esc(p.meetUrl)}">${esc(p.meetUrl)}</a></p>` : "";
  return {
    subject: `Confirmed: ${p.title} on ${p.when}`,
    html: layout(
      `<p>Hi ${esc(first!)},</p><p>Your <strong>${esc(p.title)}</strong> with ${esc(p.hostName)} is booked for <strong>${esc(p.when)}</strong>.</p>${meet}<p>Need a different time? <a href="${esc(p.manageUrl)}">Reschedule or cancel</a>.</p>`,
    ),
    text: `Hi ${first},\n\nYour ${p.title} with ${p.hostName} is booked for ${p.when}.\n${p.meetUrl ? `Join with Google Meet: ${p.meetUrl}\n` : ""}\nReschedule or cancel: ${p.manageUrl}`,
  };
}
