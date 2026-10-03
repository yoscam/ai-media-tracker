import { normalizeGenres } from "../genres";
import type { Candidate, MediaType } from "../types";
import { getJson, stripHtml } from "./http";

// Cinemeta is the keyless, IMDb-backed catalog used by Stremio.
const BASE = "https://v3-cinemeta.strem.io";

const GENRE_NAMES: Record<string, string> = {
  action: "Action", adventure: "Adventure", animation: "Animation",
  biography: "Biography", comedy: "Comedy", crime: "Crime",
  documentary: "Documentary", drama: "Drama", family: "Family",
  fantasy: "Fantasy", history: "History", horror: "Horror", mystery: "Mystery",
  romance: "Romance", "sci-fi": "Sci-Fi", sport: "Sport", thriller: "Thriller",
  war: "War", western: "Western",
};

interface Meta {
  imdb_id?: string;
  id?: string;
  name: string;
  poster?: string;
  year?: string;
  releaseInfo?: string;
  genres?: string[];
  genre?: string[];
  director?: string[];
  creator?: string[];
  description?: string;
  imdbRating?: string;
  videos?: { season?: number }[];
}

const kind = (type: MediaType) => (type === "movie" ? "movie" : "series");

function toCandidate(m: Meta, type: MediaType): Candidate {
  const rating = m.imdbRating ? Number(m.imdbRating) : NaN;
  const year = Number((m.year ?? m.releaseInfo ?? "").slice(0, 4));
  const episodes = m.videos?.filter((v) => (v.season ?? 0) > 0).length;
  return {
    type,
    source: "cinemeta",
    externalId: m.imdb_id ?? m.id ?? null,
    title: m.name,
    year: year || null,
    creator: m.director?.[0] ?? m.creator?.[0] ?? null,
    posterUrl: m.poster ?? null,
    overview: stripHtml(m.description),
    genres: normalizeGenres(m.genres ?? m.genre ?? []),
    total: type === "tv" && episodes ? episodes : null,
    quality: Number.isNaN(rating) ? undefined : rating / 10,
  };
}

export async function searchCinemeta(type: MediaType, q: string) {
  const list = await getJson<{ metas: Meta[] }>(
    `${BASE}/catalog/${kind(type)}/top/search=${encodeURIComponent(q)}.json`,
  );
  const top = list.metas.slice(0, 8);
  // Search hits carry no genres, so fetch full metadata for the best matches.
  const full = await Promise.all(
    top.map(async (m) => {
      try {
        const id = m.imdb_id ?? m.id;
        const res = await getJson<{ meta: Meta }>(`${BASE}/meta/${kind(type)}/${id}.json`);
        return { ...m, ...res.meta };
      } catch {
        return m;
      }
    }),
  );
  return full.map((m) => toCandidate(m, type));
}

export async function discoverCinemeta(type: MediaType, genres: string[], page = 1) {
  const names = genres.map((g) => GENRE_NAMES[g]).filter(Boolean).slice(0, 2);
  if (!names.length) return [];
  const lists = await Promise.all(
    names.map((name) =>
      getJson<{ metas: Meta[] }>(
        `${BASE}/catalog/${kind(type)}/top/genre=${name}${page > 1 ? `&skip=${(page - 1) * 50}` : ""}.json`,
      ).then((r) => r.metas),
    ),
  );
  const seen = new Map<string, Meta>();
  for (const m of lists.flat()) seen.set(m.imdb_id ?? m.id ?? m.name, m);
  return [...seen.values()].map((m) => toCandidate(m, type));
}
