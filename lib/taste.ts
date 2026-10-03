import { getKv } from "./db";
import { listEntries } from "./entries";
import type { Entry, MediaType, TasteGenre, TasteProfile } from "./types";

/** Maps an entry to an affinity in [-1, 1]. Planned titles carry no signal. */
export function affinity(e: Entry): number {
  if (e.status === "planning") return 0;
  if (e.rating != null) return (e.rating - 5.5) / 4.5;
  switch (e.status) {
    case "completed":
      return 0.25;
    case "in_progress":
      return 0.1;
    case "dropped":
      return -0.5;
    default:
      return 0;
  }
}

function rank(
  entries: Entry[],
  keys: (e: Entry) => string[],
): Map<string, { sum: number; count: number; ratings: number[] }> {
  const map = new Map<string, { sum: number; count: number; ratings: number[] }>();
  for (const e of entries) {
    const w = affinity(e);
    if (w === 0 && e.rating == null) continue;
    for (const k of keys(e)) {
      const cur = map.get(k) ?? { sum: 0, count: 0, ratings: [] };
      cur.sum += w;
      cur.count += 1;
      if (e.rating != null) cur.ratings.push(e.rating);
      map.set(k, cur);
    }
  }
  return map;
}

export function buildTaste(entries: Entry[] = listEntries()): TasteProfile {
  const signal = entries.filter((e) => affinity(e) !== 0).length;

  const genreStats = rank(entries, (e) => e.genres);
  const genres: TasteGenre[] = [...genreStats.entries()].map(([name, s]) => ({
    name,
    score: (s.sum / s.count) * Math.log2(1 + s.count),
    count: s.count,
    avgRating: s.ratings.length
      ? Math.round((s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length) * 10) / 10
      : null,
  }));
  const topGenres = genres
    .filter((g) => g.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  const avoidGenres = genres
    .filter((g) => g.score < -0.1)
    .sort((a, b) => a.score - b.score)
    .slice(0, 6);

  const creatorStats = rank(
    entries.filter((e) => e.creator),
    (e) => [e.creator!],
  );
  const favoriteCreators = [...creatorStats.entries()]
    .filter(([, s]) => s.sum > 0.5)
    .sort((a, b) => b[1].sum - a[1].sum)
    .slice(0, 6)
    .map(([name, s]) => ({ name, count: s.count }));

  const rated = entries.filter((e) => e.rating != null);
  const brief = (e: Entry) => ({ title: e.title, type: e.type, rating: e.rating });
  const favorites = rated
    .filter((e) => e.rating! >= 8)
    .sort((a, b) => b.rating! - a.rating!)
    .slice(0, 12)
    .map(brief);
  const disliked = entries
    .filter((e) => (e.rating != null && e.rating <= 4) || (e.status === "dropped" && (e.rating ?? 0) <= 5))
    .slice(0, 8)
    .map(brief);

  const counts = new Map<MediaType, number>();
  for (const e of entries) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);

  return {
    signal,
    topGenres,
    avoidGenres,
    favoriteCreators,
    favorites,
    disliked,
    averageRating: rated.length
      ? Math.round((rated.reduce((a, e) => a + e.rating!, 0) / rated.length) * 10) / 10
      : null,
    byType: [...counts.entries()].map(([type, count]) => ({ type, count })),
    summary: getKv("taste_summary"),
  };
}
