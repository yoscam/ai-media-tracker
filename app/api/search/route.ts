import { z } from "zod";
import { fail, handleError, ok } from "@/lib/api";
import { searchMedia, searchableTypes } from "@/lib/providers";
import { MEDIA_TYPES } from "@/lib/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  type: z.enum(MEDIA_TYPES),
  q: z.string().trim().min(1).max(200),
});

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const { type, q } = schema.parse(params);
    if (!searchableTypes()[type]) {
      return ok({ results: [], searchable: false });
    }
    try {
      return ok({ results: await searchMedia(type, q), searchable: true });
    } catch (err) {
      return fail(
        `Search provider unavailable: ${err instanceof Error ? err.message : "unknown error"}`,
        502,
      );
    }
  } catch (err) {
    return handleError(err);
  }
}
