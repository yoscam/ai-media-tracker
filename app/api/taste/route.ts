import { ok } from "@/lib/api";
import { buildTaste } from "@/lib/taste";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok(buildTaste());
}
