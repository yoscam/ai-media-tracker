export const MEDIA_TYPES = ["movie", "tv", "anime", "manga", "book", "game"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const STATUSES = [
  "planning",
  "in_progress",
  "completed",
  "paused",
  "dropped",
] as const;
export type Status = (typeof STATUSES)[number];

export const TYPE_META: Record<
  MediaType,
  { label: string; plural: string; unit: string }
> = {
  movie: { label: "Movie", plural: "Movies", unit: "min" },
  tv: { label: "TV Show", plural: "TV Shows", unit: "episodes" },
  anime: { label: "Anime", plural: "Anime", unit: "episodes" },
  manga: { label: "Manga", plural: "Manga", unit: "chapters" },
  book: { label: "Book", plural: "Books", unit: "pages" },
  game: { label: "Game", plural: "Games", unit: "hours" },
};

export const STATUS_LABEL: Record<Status, string> = {
  planning: "Planning",
  in_progress: "In progress",
  completed: "Completed",
  paused: "Paused",
  dropped: "Dropped",
};

export function statusLabel(type: MediaType, status: Status): string {
  if (status !== "in_progress") return STATUS_LABEL[status];
  if (type === "book" || type === "manga") return "Reading";
  if (type === "game") return "Playing";
  return "Watching";
}

export type Source = "anilist" | "tmdb" | "openlibrary" | "manual" | "ai";

export interface Entry {
  id: number;
  type: MediaType;
  title: string;
  year: number | null;
  creator: string | null;
  posterUrl: string | null;
  overview: string | null;
  genres: string[];
  source: Source;
  externalId: string | null;
  status: Status;
  rating: number | null;
  progress: number;
  total: number | null;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Candidate {
  type: MediaType;
  source: Source;
  externalId: string | null;
  title: string;
  year: number | null;
  creator: string | null;
  posterUrl: string | null;
  overview: string | null;
  genres: string[];
  total: number | null;
  /** 0..1 community quality signal when the provider exposes one. */
  quality?: number;
}

export interface Recommendation extends Candidate {
  id: number;
  reason: string;
  score: number;
  origin: "ai" | "local";
  createdAt: string;
}

export interface TasteGenre {
  name: string;
  score: number;
  count: number;
  avgRating: number | null;
}

export interface TasteProfile {
  signal: number;
  topGenres: TasteGenre[];
  avoidGenres: TasteGenre[];
  favoriteCreators: { name: string; count: number }[];
  favorites: { title: string; type: MediaType; rating: number | null }[];
  disliked: { title: string; type: MediaType; rating: number | null }[];
  averageRating: number | null;
  byType: { type: MediaType; count: number }[];
  summary: string | null;
}
