import { CircleCheck, CircleX, ExternalLink } from "lucide-react";
import { CopyButton } from "@/app/(app)/deals/booking/link-editor";
import { Card } from "@/components/ui";
import { appBase, appUrl } from "@/lib/app-url";
import { googleConfigured, googleKeyProblem } from "@/lib/google";

// Step-by-step Google Cloud setup with the exact values to paste, and a live
// check of what Railway currently has. The Client ID isn't secret, so we show
// its start to help spot paste mistakes; the secret is never shown.

function Copyable({ value }: { value: string }) {
  return (
    <div className="mt-1 flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-md bg-background px-2.5 py-1.5 text-xs">{value}</code>
      <CopyButton text={value} label="Copy" />
    </div>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? <CircleCheck size={15} className="mt-0.5 shrink-0 text-success" /> : <CircleX size={15} className="mt-0.5 shrink-0 text-danger" />}
      <span>{children}</span>
    </li>
  );
}

export function GoogleSetupGuide() {
  const ok = googleConfigured();
  const id = process.env.AUTH_GOOGLE_ID?.trim() ?? "";
  const secret = process.env.AUTH_GOOGLE_SECRET?.trim() ?? "";
  const authUrl = process.env.AUTH_URL?.trim() ?? "";
  const base = appBase();
  const domain = process.env.ALLOWED_EMAIL_DOMAIN?.trim() || "your company domain";

  return (
    <Card className="mb-6">
      <details open={!ok}>
        <summary className="cursor-pointer text-sm font-semibold">
          {ok ? "Google Workspace setup (done) — show the steps again" : "Set up Google Workspace (about 10 minutes)"}
        </summary>

        <div className="mt-4 rounded-lg bg-background p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">What Railway has now</h3>
          <ul className="space-y-1.5 text-sm">
            <Check ok={/\.apps\.googleusercontent\.com$/.test(id)}>
              AUTH_GOOGLE_ID: {id ? <code className="text-xs">{id.length > 40 ? `${id.slice(0, 40)}…` : id}</code> : "not set"}
            </Check>
            <Check ok={!!secret && !/\s/.test(secret)}>AUTH_GOOGLE_SECRET: {secret ? (/\s/.test(secret) ? "set, but it contains spaces (looks like example text)" : `set (${secret.length} characters)`) : "not set"}</Check>
            <Check ok={!!authUrl && authUrl.replace(/\/$/, "") === base}>AUTH_URL: {authUrl ? <code className="text-xs">{authUrl}</code> : "not set"}{authUrl.replace(/\/$/, "") !== base && <> (should be <code className="text-xs">{base}</code>)</>}</Check>
          </ul>
          {!ok && <p className="mt-2 text-xs text-danger">{googleKeyProblem()}</p>}
        </div>

        <ol className="mt-5 space-y-5 text-sm">
          <li>
            <strong>1. Open Google Cloud as your Workspace admin.</strong> Sign in with your <em>@{domain}</em> account (not a personal Gmail).
            <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 text-brand">Create a project <ExternalLink size={12} /></a>{" "}
            named <em>Outset PM</em>, then make sure it&apos;s selected at the top of the page.
          </li>
          <li>
            <strong>2. Turn on the two Google APIs.</strong> Click each link and press <em>Enable</em>:
            <a href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 text-brand">Google Calendar API <ExternalLink size={12} /></a>
            <span className="mx-1">and</span>
            <a href="https://console.cloud.google.com/apis/library/gmail.googleapis.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand">Gmail API <ExternalLink size={12} /></a>.
          </li>
          <li>
            <strong>3. Set up the sign-in screen.</strong>
            <a href="https://console.cloud.google.com/auth/overview" target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 text-brand">Google Auth Platform <ExternalLink size={12} /></a>{" "}
            → <em>Get started</em>. App name <em>Outset PM</em>, your email as support and contact email, and for <em>Audience</em> choose <strong>Internal</strong> (only people at @{domain} can use it, and Google needs no review).
          </li>
          <li>
            <strong>4. Create the keys.</strong>
            <a href="https://console.cloud.google.com/auth/clients/create" target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 text-brand">Clients → Create client <ExternalLink size={12} /></a>{" "}
            → Application type <em>Web application</em>, name <em>Outset PM</em>.
            <div className="mt-2 space-y-2">
              <div><span className="text-xs text-muted">Authorised JavaScript origins → Add URI:</span><Copyable value={base} /></div>
              <div>
                <span className="text-xs text-muted">Authorised redirect URIs → Add URI (both):</span>
                <Copyable value={appUrl("/api/auth/callback/google")} />
                <Copyable value={appUrl("/api/google/callback")} />
              </div>
            </div>
            <p className="mt-2">Press <em>Create</em>. Google shows a <strong>Client ID</strong> (ends in <code>.apps.googleusercontent.com</code>) and a <strong>Client secret</strong> (starts with <code>GOCSPX-</code>). Download the JSON or copy both now: the secret is only shown once.</p>
          </li>
          <li>
            <strong>5. Paste them into Railway.</strong> Railway → your app service → <em>Variables</em>. Replace the example text completely (no quotes, no spaces):
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li><code>AUTH_GOOGLE_ID</code> = the Client ID</li>
              <li><code>AUTH_GOOGLE_SECRET</code> = the Client secret</li>
              <li><code>AUTH_URL</code> = <code>{base}</code></li>
            </ul>
            Railway redeploys by itself (about 2 minutes). Reload this page: the checks above turn green.
          </li>
          <li>
            <strong>6. Connect each person&apos;s calendar.</strong> Everyone (you first) clicks <em>Connect Google</em> at the top of this page or on Booking Links, and approves with their @{domain} account. Bookings then use their real calendar with a Meet link, and emails send from their Gmail.
          </li>
        </ol>

        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
          <strong>If Google says “access blocked” or “admin_policy_enforced”:</strong> in the Google Admin console go to Security → Access and data control → API controls → Manage third-party app access, find <em>Outset PM</em> (by its Client ID) and set it to <em>Trusted</em>. “Error 401: invalid_client” means the Client ID in Railway is wrong; “redirect_uri_mismatch” means a redirect URI in step 4 doesn&apos;t match exactly.
        </div>
      </details>
    </Card>
  );
}
