import { handleError, ok } from "@/lib/api";
import { syncLibrary } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const force = new URL(request.url).searchParams.get("force") === "1";
    return ok(await syncLibrary(force));
  } catch (err) {
    return handleError(err);
  }
}
