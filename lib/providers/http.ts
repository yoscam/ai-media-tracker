export async function getJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 9000,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  return (await res.json()) as T;
}

export function stripHtml(s: string | null | undefined): string | null {
  if (!s) return null;
  const text = s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .trim();
  return text || null;
}
