import { z } from "zod";
import { db } from "./db";
import { normalizeGenres, normalizeTitle } from "./genres";
import {
  MEDIA_TYPES,
  STATUSES,
  type Entry,
  type MediaType,
  type Status,
} from "./types";

interface Row {
  id: number;
  type: MediaType;
  title: string;
  year: number | null;
  creator: string | null;
  poster_url: string | null;
  overview: string | null;
  genres: string;
  source: Entry["source"];
  external_id: string | null;
  status: Status;
  rating: number | null;
  progress: number;
  total: number | null;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(r: Row): Entry {
  return {
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
    status: r.status,
    rating: r.rating,
    progress: r.progress,
    total: r.total,
    notes: r.notes,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const entryInputSchema = z.object({
  type: z.enum(MEDIA_TYPES),
  title: z.string().trim().min(1).max(300),
  year: z.number().int().min(1800).max(2200).nullish(),
  creator: z.string().trim().max(300).nullish(),
  posterUrl: z.string().url().max(2000).nullish(),
  overview: z.string().max(5000).nullish(),
  genres: z.array(z.string()).max(30).default([]),
  source: z
    .enum(["anilist", "tmdb", "openlibrary", "manual", "ai"])
    .default("manual"),
  externalId: z.string().max(100).nullish(),
  status: z.enum(STATUSES).default("planning"),
  rating: z.number().int().min(1).max(10).nullish(),
  progress: z.number().int().min(0).default(0),
  total: z.number().int().min(0).nullish(),
  notes: z.string().max(10000).nullish(),
  fromRecommendation: z.number().int().optional(),
});
export type EntryInput = z.infer<typeof entryInputSchema>;

export const entryPatchSchema = entryInputSchema
  .omit({ type: true, source: true, externalId: true, fromRecommendation: true })
  .partial();
export type EntryPatch = z.infer<typeof entryPatchSchema>;

export function listEntries(): Entry[] {
  const rows = db()
    .prepare("SELECT * FROM entries ORDER BY updated_at DESC, id DESC")
    .all() as Row[];
  return rows.map(mapRow);
}

export function getEntry(id: number): Entry | null {
  const row = db().prepare("SELECT * FROM entries WHERE id = ?").get(id) as
    | Row
    | undefined;
  return row ? mapRow(row) : null;
}

export function findDuplicate(
  type: MediaType,
  title: string,
  source: string,
  externalId: string | null | undefined,
): Entry | null {
  if (externalId) {
    const row = db()
      .prepare("SELECT * FROM entries WHERE source = ? AND external_id = ?")
      .get(source, externalId) as Row | undefined;
    if (row) return mapRow(row);
  }
  const key = normalizeTitle(title);
  const rows = db()
    .prepare("SELECT * FROM entries WHERE type = ?")
    .all(type) as Row[];
  const hit = rows.find((r) => normalizeTitle(r.title) === key);
  return hit ? mapRow(hit) : null;
}

function lifecycle(
  status: Status,
  existing: { startedAt: string | null; completedAt: string | null },
  progress: number,
  total: number | null,
) {
  const now = new Date().toISOString();
  let { startedAt, completedAt } = existing;
  let nextProgress = progress;
  if (status === "in_progress" && !startedAt) startedAt = now;
  if (status === "completed") {
    startedAt ??= now;
    completedAt ??= now;
    if (total && nextProgress < total) nextProgress = total;
  } else {
    completedAt = null;
  }
  return { startedAt, completedAt, progress: nextProgress };
}

export function createEntry(input: EntryInput): Entry {
  const lc = lifecycle(
    input.status,
    { startedAt: null, completedAt: null },
    input.progress,
    input.total ?? null,
  );
  const conn = db();
  const tx = conn.transaction(() => {
    const info = conn
      .prepare(
        `INSERT INTO entries
         (type, title, year, creator, poster_url, overview, genres, source, external_id,
          status, rating, progress, total, notes, started_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.type,
        input.title,
        input.year ?? null,
        input.creator ?? null,
        input.posterUrl ?? null,
        input.overview ?? null,
        JSON.stringify(normalizeGenres(input.genres)),
        input.source,
        input.externalId ?? null,
        input.status,
        input.rating ?? null,
        lc.progress,
        input.total ?? null,
        input.notes ?? null,
        lc.startedAt,
        lc.completedAt,
      );
    if (input.fromRecommendation) {
      conn
        .prepare("DELETE FROM recommendations WHERE id = ?")
        .run(input.fromRecommendation);
    }
    return Number(info.lastInsertRowid);
  });
  return getEntry(tx())!;
}

export function updateEntry(id: number, patch: EntryPatch): Entry | null {
  const current = getEntry(id);
  if (!current) return null;
  const status = patch.status ?? current.status;
  const total = patch.total !== undefined ? patch.total : current.total;
  const lc = lifecycle(
    status,
    current,
    patch.progress ?? current.progress,
    total,
  );
  db()
    .prepare(
      `UPDATE entries SET
        title = ?, year = ?, creator = ?, poster_url = ?, overview = ?, genres = ?,
        status = ?, rating = ?, progress = ?, total = ?, notes = ?,
        started_at = ?, completed_at = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`,
    )
    .run(
      patch.title ?? current.title,
      patch.year !== undefined ? patch.year : current.year,
      patch.creator !== undefined ? patch.creator : current.creator,
      patch.posterUrl !== undefined ? patch.posterUrl : current.posterUrl,
      patch.overview !== undefined ? patch.overview : current.overview,
      JSON.stringify(
        patch.genres ? normalizeGenres(patch.genres) : current.genres,
      ),
      status,
      patch.rating !== undefined ? patch.rating : current.rating,
      lc.progress,
      total,
      patch.notes !== undefined ? patch.notes : current.notes,
      lc.startedAt,
      lc.completedAt,
      id,
    );
  return getEntry(id);
}

export function deleteEntry(id: number): boolean {
  return db().prepare("DELETE FROM entries WHERE id = ?").run(id).changes > 0;
}
