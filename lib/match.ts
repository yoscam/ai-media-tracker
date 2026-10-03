import { normalizeTitle } from "./genres";
import { searchableTypes, searchMedia } from "./providers";
import type { Candidate, MediaType } from "./types";

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(" ").filter(Boolean));
  const tb = new Set(b.split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / new Set([...ta, ...tb]).size;
}

export async function resolveAgainstProvider(
  type: MediaType,
  title: string,
  year: number | null,
): Promise<{ status: "matched"; hit: Candidate } | { status: "missing" } | { status: "unavailable" }> {
  if (!searchableTypes()[type]) return { status: "unavailable" };
  try {
    const results = await searchMedia(type, title);
    const key = normalizeTitle(title);
    const scored = results
      .map((c) => {
        const ck = normalizeTitle(c.title);
        let s = ck === key ? 1 : tokenOverlap(ck, key);
        if (ck !== key && (ck.includes(key) || key.includes(ck))) s = Math.max(s, 0.7);
        if (year && c.year && Math.abs(c.year - year) <= 1) s += 0.1;
        return { c, s };
      })
      .sort((a, b) => b.s - a.s);
    const best = scored[0];
    return best && best.s >= 0.5
      ? { status: "matched", hit: best.c }
      : { status: "missing" };
  } catch {
    return { status: "unavailable" };
  }
}

