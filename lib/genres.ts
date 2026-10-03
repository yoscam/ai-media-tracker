const ALIASES: Record<string, string[]> = {
  "science fiction": ["sci-fi"],
  "sci fi": ["sci-fi"],
  scifi: ["sci-fi"],
  "sci-fi & fantasy": ["sci-fi", "fantasy"],
  "action & adventure": ["action", "adventure"],
  "war & politics": ["war", "politics"],
  "slice-of-life": ["slice of life"],
  "science fiction & fantasy": ["sci-fi", "fantasy"],
  "mystery & thriller": ["mystery", "thriller"],
  "role-playing": ["rpg"],
  "role playing": ["rpg"],
  "role-playing (rpg)": ["rpg"],
  "roleplaying": ["rpg"],
  "romantic": ["romance"],
  scary: ["horror"],
  historical: ["history"],
  "historical fiction": ["history", "fiction"],
  "fantasy fiction": ["fantasy"],
  "juvenile fiction": [],
  "large type books": [],
  "open library staff picks": [],
  "in library": [],
  "reading level-grade 11": [],
  "accessible book": [],
  "protected daisy": [],
};

const DROP = new Set(["fiction", "novel", "novels", "general", "english"]);

export function normalizeGenres(input: string[], max = 8): string[] {
  const out: string[] = [];
  for (const raw of input) {
    const key = raw.trim().toLowerCase();
    if (!key || key.length > 28 || /\d{3,}|[:=_]/.test(key)) continue;
    const mapped =
      ALIASES[key] ??
      (key.endsWith("science fiction")
        ? ["sci-fi"]
        : key.endsWith(" fantasy")
          ? ["fantasy"]
          : [key]);
    for (const g of mapped) {
      if (g && !DROP.has(g) && !out.includes(g)) out.push(g);
    }
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}

export function titleCaseGenre(g: string): string {
  if (g === "rpg") return "RPG";
  if (g === "sci-fi") return "Sci-Fi";
  return g.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
