import { normalizeGenres } from "../genres";
import type { Candidate, MediaType } from "../types";
import { getJson, stripHtml } from "./http";

const URL_ = "https://graphql.anilist.co";

const FIELDS = `
  id
  title { romaji english }
  coverImage { large }
  startDate { year }
  genres
  description(asHtml: false)
  episodes
  chapters
  averageScore
  studios(isMain: true) { nodes { name } }
  staff(perPage: 1, sort: RELEVANCE) { nodes { name { full } } }
`;

const ANILIST_GENRES: Record<string, string> = {
  action: "Action",
  adventure: "Adventure",
  comedy: "Comedy",
  drama: "Drama",
  ecchi: "Ecchi",
  fantasy: "Fantasy",
  horror: "Horror",
  "mahou shoujo": "Mahou Shoujo",
  mecha: "Mecha",
  music: "Music",
  mystery: "Mystery",
  psychological: "Psychological",
  romance: "Romance",
  "sci-fi": "Sci-Fi",
  "slice of life": "Slice of Life",
  sports: "Sports",
  supernatural: "Supernatural",
  thriller: "Thriller",
};

interface AniMedia {
  id: number;
  title: { romaji: string | null; english: string | null };
  coverImage: { large: string | null };
  startDate: { year: number | null };
  genres: string[];
  description: string | null;
  episodes: number | null;
  chapters: number | null;
  averageScore: number | null;
  studios?: { nodes: { name: string }[] };
  staff?: { nodes: { name: { full: string } }[] };
}

function toCandidate(m: AniMedia, type: MediaType): Candidate {
  return {
    type,
    source: "anilist",
    externalId: String(m.id),
    title: m.title.english ?? m.title.romaji ?? "Untitled",
    year: m.startDate.year,
    creator:
      type === "anime"
        ? (m.studios?.nodes[0]?.name ?? null)
        : (m.staff?.nodes[0]?.name.full ?? null),
    posterUrl: m.coverImage.large,
    overview: stripHtml(m.description),
    genres: normalizeGenres(m.genres),
    total: type === "anime" ? m.episodes : m.chapters,
    quality: m.averageScore != null ? m.averageScore / 100 : undefined,
  };
}

const aniType = (t: MediaType) => (t === "anime" ? "ANIME" : "MANGA");

async function query(q: string, variables: Record<string, unknown>) {
  const json = await getJson<{ data: { Page: { media: AniMedia[] } } }>(URL_, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: q, variables }),
  });
  return json.data.Page.media;
}

export async function searchAniList(type: MediaType, q: string) {
  const media = await query(
    `query($q:String,$type:MediaType){Page(perPage:12){media(search:$q,type:$type,sort:SEARCH_MATCH,isAdult:false){${FIELDS}}}}`,
    { q, type: aniType(type) },
  );
  return media.map((m) => toCandidate(m, type));
}

export async function discoverAniList(
  type: MediaType,
  genres: string[],
  page = 1,
) {
  const mapped = genres.map((g) => ANILIST_GENRES[g]).filter(Boolean);
  if (!mapped.length) return [];
  // AniList's genre_in is an AND filter, so widen from two genres to one when sparse.
  const attempts = [mapped.slice(0, 2), mapped.slice(0, 1)];
  const seen = new Map<number, AniMedia>();
  for (const attempt of attempts) {
    for (const p of [page, 1]) {
      const media = await query(
        `query($type:MediaType,$genres:[String],$page:Int){Page(page:$page,perPage:30){media(type:$type,genre_in:$genres,sort:POPULARITY_DESC,isAdult:false,averageScore_greater:68){${FIELDS}}}}`,
        { type: aniType(type), genres: attempt, page: p },
      );
      media.forEach((m) => seen.set(m.id, m));
      if (media.length) break;
    }
    if (seen.size >= 20) break;
  }
  return [...seen.values()].map((m) => toCandidate(m, type));
}
