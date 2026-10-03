import type { Candidate, MediaType } from "../types";
import { discoverAniList, searchAniList } from "./anilist";
import { discoverOpenLibrary, searchOpenLibrary } from "./openlibrary";
import { discoverTmdb, searchTmdb, tmdbConfigured } from "./tmdb";

export function searchableTypes(): Record<MediaType, boolean> {
  const tmdb = tmdbConfigured();
  return {
    movie: tmdb,
    tv: tmdb,
    anime: true,
    manga: true,
    book: true,
    game: false,
  };
}

export async function searchMedia(type: MediaType, q: string): Promise<Candidate[]> {
  switch (type) {
    case "anime":
    case "manga":
      return searchAniList(type, q);
    case "book":
      return searchOpenLibrary(q);
    case "movie":
    case "tv":
      return tmdbConfigured() ? searchTmdb(type, q) : [];
    default:
      return [];
  }
}

export async function discoverMedia(
  type: MediaType,
  genres: string[],
  page = 1,
): Promise<Candidate[]> {
  switch (type) {
    case "anime":
    case "manga":
      return discoverAniList(type, genres, page);
    case "book":
      return discoverOpenLibrary(genres, page);
    case "movie":
    case "tv":
      return tmdbConfigured() ? discoverTmdb(type, genres, page) : [];
    default:
      return [];
  }
}
