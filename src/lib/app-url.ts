/**
 * Absolute URL for links in emails, booking pages and OAuth redirects.
 * AUTH_URL wins; on Railway we fall back to the service's public domain so
 * links never point at localhost in production.
 */
export function appBase() {
  const configured = process.env.AUTH_URL?.trim().replace(/\/$/, "");
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (configured && /^https?:\/\//.test(configured) && !(railway && /localhost|127\.0\.0\.1/.test(configured))) return configured;
  if (railway) return `https://${railway}`;
  return configured && /^https?:\/\//.test(configured) ? configured : "http://localhost:3000";
}

export function appUrl(path = "/") {
  return `${appBase()}${path.startsWith("/") ? path : `/${path}`}`;
}
