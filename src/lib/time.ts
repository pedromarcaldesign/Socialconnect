// Conversão entre a hora local da marca e UTC. Partilhado pelo browser e pelo servidor.
import { TZDate } from "@date-fns/tz";

export type LocalParts = { date: string; time: string }; // "2026-10-20", "09:30"

const pad = (n: number) => String(n).padStart(2, "0");

export function partsInZone(instant: Date, timezone: string): LocalParts {
  const d = new TZDate(instant.getTime(), timezone);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/**
 * Hora local da marca → instante UTC. Devolve null se a hora não existir nesse dia
 * (salto da mudança de hora). Numa hora ambígua (recuo), usa a primeira ocorrência.
 */
export function zonedToUtc(parts: LocalParts, timezone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(parts.date);
  const t = /^(\d{2}):(\d{2})$/.exec(parts.time);
  if (!m || !t) return null;
  const [y, mo, d, h, mi] = [+m[1], +m[2], +m[3], +t[1], +t[2]];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  // Tentar os offsets possíveis (-14h..+14h) e ficar com o mais cedo que reproduz a hora local.
  const naiveUtc = Date.UTC(y, mo - 1, d, h, mi);
  let best: number | null = null;
  for (let off = -14 * 60; off <= 14 * 60; off += 15) {
    const candidate = naiveUtc - off * 60_000;
    const p = partsInZone(new Date(candidate), timezone);
    if (p.date === parts.date && p.time === parts.time && (best === null || candidate < best)) best = candidate;
  }
  return best === null ? null : new Date(best);
}

export function formatInZone(instant: Date, timezone: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("pt-PT", { timeZone: timezone, dateStyle: "medium", timeStyle: "short", ...opts }).format(instant);
}
