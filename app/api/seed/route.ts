import { fail, ok } from "@/lib/api";
import { seedSampleLibrary } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST() {
  const added = seedSampleLibrary();
  return added ? ok({ added }, 201) : fail("Library is not empty.", 409);
}
