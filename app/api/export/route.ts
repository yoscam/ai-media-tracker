import { listEntries } from "@/lib/entries";

export const dynamic = "force-dynamic";

export async function GET() {
  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), entries: listEntries() },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="media-library.json"',
    },
  });
}
