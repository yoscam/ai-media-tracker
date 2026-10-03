import { fail, handleError, ok } from "@/lib/api";
import {
  createEntry,
  entryInputSchema,
  findDuplicate,
  listEntries,
} from "@/lib/entries";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok(listEntries());
}

export async function POST(request: Request) {
  try {
    const input = entryInputSchema.parse(await request.json());
    const dupe = findDuplicate(
      input.type,
      input.title,
      input.source,
      input.externalId,
      input.year,
    );
    if (dupe) return fail(`"${dupe.title}" is already in your library.`, 409);
    return ok(createEntry(input), 201);
  } catch (err) {
    return handleError(err);
  }
}
