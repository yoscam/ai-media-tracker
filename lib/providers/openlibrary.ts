import { normalizeGenres } from "../genres";
import type { Candidate } from "../types";
import { getJson } from "./http";

interface OLDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  subject?: string[];
  number_of_pages_median?: number;
  ratings_average?: number;
}

const FIELDS =
  "key,title,author_name,first_publish_year,cover_i,subject,number_of_pages_median,ratings_average";

function toCandidate(d: OLDoc): Candidate {
  return {
    type: "book",
    source: "openlibrary",
    externalId: d.key,
    title: d.title,
    year: d.first_publish_year ?? null,
    creator: d.author_name?.[0] ?? null,
    posterUrl: d.cover_i
      ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`
      : null,
    overview: null,
    genres: normalizeGenres(d.subject ?? [], 6),
    total: d.number_of_pages_median ?? null,
    quality: d.ratings_average ? d.ratings_average / 5 : undefined,
  };
}

export async function searchOpenLibrary(q: string) {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=12&fields=${FIELDS}`;
  const json = await getJson<{ docs: OLDoc[] }>(url);
  return json.docs.map(toCandidate);
}

export async function discoverOpenLibrary(genres: string[], page = 1) {
  const subjects = genres
    .slice(0, 2)
    .map((g) => `subject:"${g === "sci-fi" ? "science fiction" : g}"`)
    .join(" ");
  if (!subjects) return [];
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(subjects)}&sort=rating&limit=30&page=${page}&fields=${FIELDS}`;
  const json = await getJson<{ docs: OLDoc[] }>(url);
  return json.docs
    .filter((d) => d.cover_i && d.ratings_average && !/\b(vol\.?|volume)\s*\d+/i.test(d.title))
    .map(toCandidate);
}
