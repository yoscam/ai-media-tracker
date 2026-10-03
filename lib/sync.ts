import { db } from "./db";
import { listEntries } from "./entries";
import { resolveAgainstProvider } from "./match";
import { normalizeGenres } from "./genres";
import type { Entry } from "./types";

export interface SyncResult {
  checked: number;
  updated: number;
  unmatched: string[];
  skipped: number;
}

const needsSync = (e: Entry, force: boolean) =>
  e.type !== "game" &&
  (force || e.source === "manual" || e.source === "ai" || !e.posterUrl);

async function resolveWithRetry(e: Entry) {
  const first = await resolveAgainstProvider(e.type, e.title, e.year);
  if (first.status !== "unavailable") return first;
  await new Promise((r) => setTimeout(r, 800));
  return resolveAgainstProvider(e.type, e.title, e.year);
}

/**
 * Fills in posters, overviews, genres and provider ids for entries that were typed
 * in by hand. Never touches status, rating, progress or notes.
 */
export async function syncLibrary(force = false): Promise<SyncResult> {
  const targets = listEntries().filter((e) => needsSync(e, force));
  const result: SyncResult = { checked: targets.length, updated: 0, unmatched: [], skipped: 0 };
  const conn = db();

  const update = conn.prepare(
    `UPDATE entries SET
       poster_url = ?, overview = ?, genres = ?, creator = ?, year = ?, total = ?,
       source = ?, external_id = ?
     WHERE id = ?`,
  );
  const taken = conn.prepare(
    "SELECT id FROM entries WHERE source = ? AND external_id = ? AND id != ?",
  );

  for (let i = 0; i < targets.length; i += 4) {
    const batch = targets.slice(i, i + 4);
    const resolved = await Promise.all(
      batch.map(async (e) => ({ e, res: await resolveWithRetry(e) })),
    );
    for (const { e, res } of resolved) {
      if (res.status === "unavailable") {
        result.skipped++;
        continue;
      }
      if (res.status === "missing") {
        result.unmatched.push(e.title);
        continue;
      }
      const hit = res.hit;
      const idTaken =
        hit.externalId && taken.get(hit.source, hit.externalId, e.id) !== undefined;
      update.run(
        hit.posterUrl ?? e.posterUrl,
        e.overview ?? hit.overview,
        JSON.stringify(hit.genres.length ? hit.genres : normalizeGenres(e.genres)),
        e.creator ?? hit.creator,
        e.year ?? hit.year,
        e.total ?? hit.total,
        idTaken ? e.source : hit.source,
        idTaken ? e.externalId : hit.externalId,
        e.id,
      );
      result.updated++;
    }
  }
  return result;
}
