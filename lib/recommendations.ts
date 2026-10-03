import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";
import { db, setKv } from "./db";
import { listEntries } from "./entries";
import { normalizeGenres, normalizeTitle, titleCaseGenre } from "./genres";
import { discoverMedia, searchableTypes, searchMedia } from "./providers";
import { affinity, buildTaste } from "./taste";
import {
  MEDIA_TYPES,
  TYPE_META,
  type Candidate,
  type Entry,
  type MediaType,
  type Recommendation,
  type TasteProfile,
} from "./types";

export function aiConfig() {
  const apiKey = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  const baseURL = process.env.AI_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "";
  const model = process.env.AI_MODEL ?? "gpt-4o-mini";
  return {
    configured: Boolean(apiKey || baseURL),
    apiKey: apiKey || "not-needed",
    baseURL: baseURL || undefined,
    model,
  };
}

interface RecRow {
  id: number;
  type: MediaType;
  title: string;
  year: number | null;
  creator: string | null;
  poster_url: string | null;
  overview: string | null;
  genres: string;
  source: Recommendation["source"];
  external_id: string | null;
  total: number | null;
  reason: string;
  score: number;
  origin: "ai" | "local";
  created_at: string;
}

const mapRec = (r: RecRow): Recommendation => ({
  id: r.id,
  type: r.type,
  title: r.title,
  year: r.year,
  creator: r.creator,
  posterUrl: r.poster_url,
  overview: r.overview,
  genres: JSON.parse(r.genres) as string[],
  source: r.source,
  externalId: r.external_id,
  total: r.total,
  reason: r.reason,
  score: r.score,
  origin: r.origin,
  createdAt: r.created_at,
});

export function listRecommendations(): Recommendation[] {
  const rows = db()
    .prepare(
      "SELECT * FROM recommendations WHERE dismissed = 0 ORDER BY score DESC, id ASC",
    )
    .all() as RecRow[];
  return rows.map(mapRec);
}

export function dismissRecommendation(id: number): boolean {
  return (
    db().prepare("UPDATE recommendations SET dismissed = 1 WHERE id = ?").run(id)
      .changes > 0
  );
}

const keyOf = (type: MediaType, title: string) =>
  `${type}|${normalizeTitle(title)}`;

function exclusionKeys(entries: Entry[]) {
  const library = new Set(entries.map((e) => keyOf(e.type, e.title)));
  const dismissed = (
    db()
      .prepare("SELECT type, title FROM recommendations WHERE dismissed = 1")
      .all() as { type: MediaType; title: string }[]
  ).map((r) => keyOf(r.type, r.title));
  return { library, dismissed: new Set(dismissed) };
}

type Draft = Candidate & { reason: string; score: number; origin: "ai" | "local" };

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(" ").filter(Boolean));
  const tb = new Set(b.split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / new Set([...ta, ...tb]).size;
}

async function resolveAgainstProvider(
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

const aiSchema = z.object({
  tasteSummary: z.string(),
  recommendations: z.array(
    z.object({
      title: z.string(),
      type: z.enum(MEDIA_TYPES),
      year: z.number().int().nullable(),
      creator: z.string().nullable(),
      genres: z.array(z.string()),
      reason: z.string(),
    }),
  ),
});

function describeTaste(taste: TasteProfile, entries: Entry[]): string {
  const lines: string[] = [];
  const fmt = (x: { title: string; type: MediaType; rating: number | null }) =>
    `${x.title} (${TYPE_META[x.type].label}${x.rating ? `, ${x.rating}/10` : ""})`;
  if (taste.favorites.length) lines.push(`Loved: ${taste.favorites.map(fmt).join("; ")}`);
  if (taste.disliked.length) lines.push(`Disliked or dropped: ${taste.disliked.map(fmt).join("; ")}`);
  if (taste.topGenres.length)
    lines.push(`Favorite genres: ${taste.topGenres.map((g) => titleCaseGenre(g.name)).join(", ")}`);
  if (taste.avoidGenres.length)
    lines.push(`Genres to avoid: ${taste.avoidGenres.map((g) => titleCaseGenre(g.name)).join(", ")}`);
  if (taste.favoriteCreators.length)
    lines.push(`Favorite creators: ${taste.favoriteCreators.map((c) => c.name).join(", ")}`);
  const middling = entries
    .filter((e) => e.rating != null && e.rating >= 5 && e.rating < 8)
    .slice(0, 10)
    .map((e) => `${e.title} (${e.rating}/10)`);
  if (middling.length) lines.push(`Lukewarm: ${middling.join("; ")}`);
  return lines.join("\n");
}

async function aiDrafts(
  types: MediaType[],
  count: number,
  entries: Entry[],
  taste: TasteProfile,
  excluded: Set<string>,
): Promise<{ drafts: Draft[]; summary: string }> {
  const cfg = aiConfig();
  const provider = createOpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
  const known = [...entries.map((e) => e.title), ...[...excluded].map((k) => k.split("|")[1])];

  const { output } = await generateText({
    model: provider.chat(cfg.model),
    output: Output.object({ schema: aiSchema }),
    system:
      "You are the recommendation engine of a personal media tracker. " +
      "Recommend only real, existing titles that you are confident about; never invent titles. " +
      "Tailor every pick to the user's taste profile and explain it in one concise sentence that names specific titles, genres or creators they love. " +
      "Mix reliable matches with one or two adventurous picks. Never repeat anything from the exclusion list. " +
      "Use the canonical English title as commonly used. Genres should be short lowercase-friendly words like 'sci-fi', 'drama', 'thriller'.",
    prompt: [
      `Recommend ${count + 4} titles. Allowed types: ${types.join(", ")}. Spread picks across the allowed types in proportion to how much the user consumes them.`,
      "",
      "TASTE PROFILE",
      describeTaste(taste, entries),
      "",
      `EXCLUSION LIST (already tracked or rejected): ${known.slice(0, 250).join("; ") || "none"}`,
      "",
      "Also write tasteSummary: 2 sentences, second person, describing what this person seems to enjoy.",
    ].join("\n"),
    abortSignal: AbortSignal.timeout(90_000),
  });

  const resolved = await Promise.all(
    output.recommendations
      .filter((r) => types.includes(r.type))
      .map(async (r): Promise<Draft | null> => {
        const res = await resolveAgainstProvider(r.type, r.title, r.year);
        if (res.status === "missing") return null;
        const base: Candidate =
          res.status === "matched"
            ? {
                ...res.hit,
                genres: res.hit.genres.length ? res.hit.genres : normalizeGenres(r.genres),
                creator: res.hit.creator ?? r.creator,
              }
            : {
                type: r.type,
                source: "ai",
                externalId: null,
                title: r.title,
                year: r.year,
                creator: r.creator,
                posterUrl: null,
                overview: null,
                genres: normalizeGenres(r.genres),
                total: null,
              };
        return { ...base, reason: r.reason, score: 0, origin: "ai" };
      }),
  );

  const drafts = resolved
    .filter((d): d is Draft => d !== null)
    .map((d, i, all) => ({ ...d, score: 1 - i / Math.max(all.length, 1) }));
  return { drafts, summary: output.tasteSummary };
}

function genreWeights(taste: TasteProfile) {
  const all = [...taste.topGenres, ...taste.avoidGenres];
  const max = Math.max(0.0001, ...taste.topGenres.map((g) => g.score));
  return new Map(all.map((g) => [g.name, Math.max(-1, Math.min(1, g.score / max))]));
}

async function localDrafts(
  types: MediaType[],
  count: number,
  entries: Entry[],
  taste: TasteProfile,
): Promise<Draft[]> {
  const weights = genreWeights(taste);
  const favorites = entries.filter((e) => e.rating != null && e.rating >= 8);
  const perType = Math.max(2, Math.ceil(count / Math.max(types.length, 1)));

  const perTypeDrafts = await Promise.all(
    types.map(async (type) => {
      const own = buildTaste(entries.filter((e) => e.type === type));
      const source = own.signal >= 2 && own.topGenres.length ? own : taste;
      const genres = source.topGenres.slice(0, 3).map((g) => g.name);
      if (!genres.length) return [];
      const page = 1 + Math.floor(Math.random() * 3);
      let candidates: Candidate[] = [];
      try {
        candidates = await discoverMedia(type, genres, page);
      } catch (err) {
        console.warn(`discover(${type}) failed:`, err instanceof Error ? err.message : err);
        return [];
      }
      return candidates
        .map((c): Draft => {
          const rel =
            c.genres.reduce((s, g) => s + (weights.get(g) ?? 0), 0) /
            Math.sqrt(Math.max(1, c.genres.length));
          const score = rel + 0.6 * (c.quality ?? 0.6);
          const matched = c.genres
            .filter((g) => (weights.get(g) ?? 0) > 0)
            .sort((a, b) => (weights.get(b) ?? 0) - (weights.get(a) ?? 0))
            .slice(0, 3)
            .map(titleCaseGenre);
          const twin = favorites
            .map((f) => ({ f, shared: f.genres.filter((g) => c.genres.includes(g)).length }))
            .filter((x) => x.shared >= 2)
            .sort((a, b) => b.shared - a.shared)[0]?.f;
          const reason = matched.length
            ? `Matches your taste for ${matched.join(", ")}${twin ? `, much like ${twin.title}` : ""}.`
            : "Highly rated in genres you tend to enjoy.";
          return { ...c, reason, score, origin: "local" };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, perType + 4);
    }),
  );
  return perTypeDrafts.flat();
}

function interleaveByType(drafts: Draft[]): Draft[] {
  const groups = new Map<MediaType, Draft[]>();
  for (const d of [...drafts].sort((a, b) => b.score - a.score)) {
    groups.set(d.type, [...(groups.get(d.type) ?? []), d]);
  }
  const lists = [...groups.values()];
  const out: Draft[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    const round = lists.map((l) => l[i]).filter(Boolean);
    out.push(...round.sort((a, b) => b.score - a.score));
  }
  return out;
}

export interface GenerateResult {
  recommendations: Recommendation[];
  mode: "ai" | "local";
  notice: string | null;
}

export async function generateRecommendations(opts: {
  type: MediaType | "all";
  count: number;
}): Promise<GenerateResult> {
  const entries = listEntries();
  const taste = buildTaste(entries);
  const { library, dismissed } = exclusionKeys(entries);
  const excluded = new Set([...library, ...dismissed]);
  const count = Math.min(Math.max(opts.count, 1), 20);

  const rated = entries.filter((e) => affinity(e) !== 0).length;
  if (rated < 1) {
    throw new Error(
      "Rate or complete at least one title first so there is a taste to work from.",
    );
  }

  let types: MediaType[];
  if (opts.type !== "all") {
    types = [opts.type];
  } else {
    const tracked = taste.byType.map((b) => b.type);
    types = tracked.length ? tracked : [...MEDIA_TYPES];
  }

  let drafts: Draft[] = [];
  let mode: "ai" | "local" = "local";
  let notice: string | null = null;

  if (aiConfig().configured) {
    try {
      const out = await aiDrafts(types, count, entries, taste, excluded);
      drafts = out.drafts;
      mode = "ai";
      setKv("taste_summary", out.summary);
    } catch (err) {
      notice = `The AI model could not be reached (${err instanceof Error ? err.message : "unknown error"}). Showing taste-matched picks from metadata providers instead.`;
    }
  } else {
    notice =
      "No AI model configured, so these picks come from your genre taste profile. Set AI_API_KEY to get personalised explanations.";
  }

  if (mode === "local") {
    drafts = await localDrafts(types, count, entries, taste);
  }

  const seen = new Set<string>();
  const kept: Draft[] = [];
  for (const d of interleaveByType(drafts)) {
    const k = keyOf(d.type, d.title);
    if (excluded.has(k) || seen.has(k)) continue;
    if (
      d.externalId &&
      entries.some((e) => e.source === d.source && e.externalId === d.externalId)
    )
      continue;
    seen.add(k);
    kept.push(d);
    if (kept.length >= count) break;
  }

  if (!kept.length) {
    return {
      recommendations: listRecommendations(),
      mode,
      notice:
        notice ??
        "Nothing new came back. Try another media type or rate more titles.",
    };
  }

  const conn = db();
  conn.transaction(() => {
    if (opts.type === "all") {
      conn.prepare("DELETE FROM recommendations WHERE dismissed = 0").run();
    } else {
      conn
        .prepare("DELETE FROM recommendations WHERE dismissed = 0 AND type = ?")
        .run(opts.type);
    }
    const insert = conn.prepare(
      `INSERT INTO recommendations
       (type, title, title_key, year, creator, poster_url, overview, genres, source,
        external_id, total, reason, score, origin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const d of kept) {
      insert.run(
        d.type, d.title, normalizeTitle(d.title), d.year, d.creator, d.posterUrl,
        d.overview, JSON.stringify(d.genres), d.source, d.externalId, d.total,
        d.reason, d.score, d.origin,
      );
    }
  })();

  return { recommendations: listRecommendations(), mode, notice };
}
