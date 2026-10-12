/** Absolute URL for links in emails and OAuth redirects. */
export function appUrl(path = "/") {
  const base = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
