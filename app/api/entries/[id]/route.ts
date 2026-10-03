import { fail, handleError, ok, parseId } from "@/lib/api";
import { deleteEntry, entryPatchSchema, updateEntry } from "@/lib/entries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    if (!id) return fail("Invalid id", 400);
    const patch = entryPatchSchema.parse(await request.json());
    const entry = updateEntry(id, patch);
    return entry ? ok(entry) : fail("Not found", 404);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id) return fail("Invalid id", 400);
  return deleteEntry(id) ? ok({ deleted: true }) : fail("Not found", 404);
}
