import { normalizeGenres } from "../genres";
import type { Candidate, MediaType } from "../types";
import { getJson } from "./http";

const BASE = "https://api.themoviedb.org/3";

export function tmdbConfigured(): boolean {
  return Boolean(process.env.TMDB_API_KEY);
}

function auth(): { headers: Record<string, string>; qs: string } {
  const key = process.env.TMDB_API_KEY ?? "";
  // v4 read-access tokens are JWTs; v3 keys are 32 hex chars.
  if (key.length > 60) {
    return { headers: { Authorization: `Bearer ${key}` }, qs: "" };
  }
  return { headers: {}, qs: `&api_key=${encodeURIComponent(key)}` };
}

const MOVIE_GENRES: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
  878: "Science Fiction", 10770: "TV Movie", 53: "Thriller", 10752: "War",
  37: "Western",
};
const TV_GENRES: Record<number, string> = {
  10759: "Action & Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 10762: "Kids", 9648: "Mystery",
  10763: "News", 10764: "Reality", 10765: "Sci-Fi & Fantasy", 10766: "Soap",
  10767: "Talk", 10768: "War & Politics", 37: "Western",
};

interface TmdbItem {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  overview: string;
  genre_ids: number[];
  vote_average: number;
}

function toCandidate(i: TmdbItem, type: MediaType): Candidate {
  const table = type === "movie" ? MOVIE_GENRES : TV_GENRES;
  const date = type === "movie" ? i.release_date : i.first_air_date;
  return {
    type,
    source: "tmdb",
    externalId: `${type}:${i.id}`,
    title: (type === "movie" ? i.title : i.name) ?? "Untitled",
    year: date ? Number(date.slice(0, 4)) || null : null,
    creator: null,
    posterUrl: i.poster_path ? `https://image.tmdb.org/t/p/w342${i.poster_path}` : null,
    overview: i.overview || null,
    genres: normalizeGenres(i.genre_ids.map((id) => table[id]).filter(Boolean)),
    total: null,
    quality: i.vote_average ? i.vote_average / 10 : undefined,
  };
}

export async function searchTmdb(type: MediaType, q: string) {
  const { headers, qs } = auth();
  const kind = type === "movie" ? "movie" : "tv";
  const json = await getJson<{ results: TmdbItem[] }>(
    `${BASE}/search/${kind}?query=${encodeURIComponent(q)}&include_adult=false${qs}`,
    { headers },
  );
  return json.results.slice(0, 12).map((i) => toCandidate(i, type));
}

export async function discoverTmdb(type: MediaType, genres: string[], page = 1) {
  const { headers, qs } = auth();
  const kind = type === "movie" ? "movie" : "tv";
  const table = type === "movie" ? MOVIE_GENRES : TV_GENRES;
  const ids: number[] = [];
  for (const [id, name] of Object.entries(table)) {
    if (normalizeGenres([name]).some((n) => genres.includes(n))) {
      ids.push(Number(id));
    }
  }
  if (!ids.length) return [];
  const json = await getJson<{ results: TmdbItem[] }>(
    `${BASE}/discover/${kind}?with_genres=${ids.slice(0, 3).join("|")}&sort_by=vote_average.desc&vote_count.gte=800&page=${page}${qs}`,
    { headers },
  );
  return json.results.map((i) => toCandidate(i, type));
}
