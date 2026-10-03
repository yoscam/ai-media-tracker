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

const KEYWORDS: [string, string][] = [
  ["science fiction", "sci-fi"], ["science-fiction", "sci-fi"], ["sci-fi", "sci-fi"],
  ["fantasy", "fantasy"], ["mystery", "mystery"], ["detective", "mystery"],
  ["thriller", "thriller"], ["suspense", "thriller"], ["horror", "horror"],
  ["romance", "romance"], ["historical", "history"], ["history", "history"],
  ["adventure", "adventure"], ["dystopia", "dystopian"], ["crime", "crime"],
  ["humor", "comedy"], ["comedy", "comedy"], ["biograph", "biography"],
  ["philosoph", "philosophy"], ["psycholog", "psychological"], ["war", "war"],
  ["drama", "drama"], ["classic", "classics"], ["cyberpunk", "cyberpunk"],
  ["space opera", "space opera"], ["young adult", "young adult"],
];

// Open Library subjects are free-form tags; keep only ones that describe a genre.
function bookGenres(subjects: string[]): string[] {
  const text = subjects.map((s) => s.toLowerCase());
  const out: string[] = [];
  for (const [needle, genre] of KEYWORDS) {
    if (!out.includes(genre) && text.some((t) => new RegExp(`\\b${needle}`).test(t))) out.push(genre);
  }
  return out.slice(0, 6);
}

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
    genres: bookGenres(d.subject ?? []),
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
