// Durations typed by people: "1h30", "1h 30m", "1.5", "90m", "1:30", "45".
// A bare number up to 12 means hours; above 12 means minutes.
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d+):(\d{1,2})$/))) return Number(m[1]) * 60 + Number(m[2]);
  if ((m = s.match(/^(?:(\d+(?:[.,]\d+)?)h)?(?:(\d+)m?)?$/)) && (m[1] || m[2])) {
    if (m[1] && !s.includes("h")) return null;
    const h = m[1] ? Number(m[1].replace(",", ".")) : 0;
    const min = m[2] ? Number(m[2]) : 0;
    if (!m[1] && !s.endsWith("m")) return min <= 12 ? min * 60 : min;
    const total = Math.round(h * 60 + min);
    return total > 0 ? total : null;
  }
  if ((m = s.match(/^(\d+[.,]\d+)$/))) return Math.round(Number(m[1].replace(",", ".")) * 60);
  return null;
}

export function formatMinutes(min: number) {
  if (!min) return "0h";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}

export function formatClock(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
