import { ZodError } from "zod";

export function ok<T>(data: T, status = 200) {
  return Response.json(data, { status });
}

export function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function handleError(err: unknown) {
  if (err instanceof ZodError) {
    return fail(err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), 422);
  }
  if (err instanceof SyntaxError) return fail("Invalid JSON body", 400);
  console.error(err);
  return fail(err instanceof Error ? err.message : "Unexpected error", 500);
}

export function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}
