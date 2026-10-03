import { z } from "zod";
import { handleError, ok } from "@/lib/api";
import {
  aiConfig,
  generateRecommendations,
  listRecommendations,
} from "@/lib/recommendations";
import { MEDIA_TYPES } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  return ok({
    recommendations: listRecommendations(),
    ai: { configured: aiConfig().configured, model: aiConfig().model },
  });
}

const body = z.object({
  type: z.enum(["all", ...MEDIA_TYPES]).default("all"),
  count: z.number().int().min(1).max(20).default(8),
});

export async function POST(request: Request) {
  try {
    const raw = await request.json().catch(() => ({}));
    const { type, count } = body.parse(raw);
    return ok(await generateRecommendations({ type, count }));
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Rate or complete")) {
      return Response.json({ error: err.message }, { status: 422 });
    }
    return handleError(err);
  }
}
