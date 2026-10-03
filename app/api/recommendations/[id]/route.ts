import { fail, ok, parseId } from "@/lib/api";
import { dismissRecommendation } from "@/lib/recommendations";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = parseId((await params).id);
  if (!id) return fail("Invalid id", 400);
  return dismissRecommendation(id) ? ok({ dismissed: true }) : fail("Not found", 404);
}
