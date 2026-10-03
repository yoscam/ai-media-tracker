import { createEntry, listEntries, type EntryInput } from "./entries";

type Seed = Pick<
  EntryInput,
  "type" | "title" | "year" | "creator" | "genres" | "status" | "rating"
> &
  Partial<Pick<EntryInput, "progress" | "total">>;

const SAMPLE: Seed[] = [
  { type: "movie", title: "Blade Runner 2049", year: 2017, creator: "Denis Villeneuve", genres: ["sci-fi", "drama", "thriller"], status: "completed", rating: 9 },
  { type: "movie", title: "Arrival", year: 2016, creator: "Denis Villeneuve", genres: ["sci-fi", "drama", "mystery"], status: "completed", rating: 9 },
  { type: "movie", title: "Interstellar", year: 2014, creator: "Christopher Nolan", genres: ["sci-fi", "adventure", "drama"], status: "completed", rating: 10 },
  { type: "movie", title: "The Notebook", year: 2004, creator: "Nick Cassavetes", genres: ["romance", "drama"], status: "dropped", rating: 4 },
  { type: "movie", title: "Dune: Part Two", year: 2024, creator: "Denis Villeneuve", genres: ["sci-fi", "adventure", "drama"], status: "planning" },
  { type: "tv", title: "Severance", year: 2022, creator: "Dan Erickson", genres: ["sci-fi", "thriller", "mystery", "drama"], status: "in_progress", rating: 9, progress: 14, total: 19 },
  { type: "tv", title: "Breaking Bad", year: 2008, creator: "Vince Gilligan", genres: ["crime", "drama", "thriller"], status: "completed", rating: 10, total: 62 },
  { type: "anime", title: "Cowboy Bebop", year: 1998, creator: "Sunrise", genres: ["action", "sci-fi", "drama"], status: "completed", rating: 9, total: 26 },
  { type: "anime", title: "Steins;Gate", year: 2011, creator: "White Fox", genres: ["sci-fi", "thriller", "drama"], status: "completed", rating: 9, total: 24 },
  { type: "anime", title: "Death Note", year: 2006, creator: "Madhouse", genres: ["mystery", "psychological", "thriller", "supernatural"], status: "completed", rating: 8, total: 37 },
  { type: "anime", title: "Kaguya-sama: Love Is War", year: 2019, creator: "A-1 Pictures", genres: ["comedy", "romance"], status: "completed", rating: 6, total: 12 },
  { type: "anime", title: "Sword Art Online", year: 2012, creator: "A-1 Pictures", genres: ["action", "adventure", "fantasy", "romance"], status: "dropped", rating: 4, progress: 7, total: 25 },
  { type: "manga", title: "Monster", year: 1994, creator: "Naoki Urasawa", genres: ["mystery", "thriller", "psychological", "drama"], status: "completed", rating: 9, total: 162 },
  { type: "manga", title: "Berserk", year: 1989, creator: "Kentaro Miura", genres: ["action", "fantasy", "horror", "drama"], status: "in_progress", rating: 10, progress: 280, total: 374 },
  { type: "book", title: "Dune", year: 1965, creator: "Frank Herbert", genres: ["sci-fi", "adventure"], status: "completed", rating: 9, total: 412 },
  { type: "book", title: "Project Hail Mary", year: 2021, creator: "Andy Weir", genres: ["sci-fi", "adventure"], status: "completed", rating: 9, total: 476 },
  { type: "book", title: "The Name of the Wind", year: 2007, creator: "Patrick Rothfuss", genres: ["fantasy", "adventure"], status: "completed", rating: 7, total: 662 },
  { type: "book", title: "Pride and Prejudice", year: 1813, creator: "Jane Austen", genres: ["romance", "drama"], status: "dropped", rating: 5, progress: 80, total: 279 },
  { type: "game", title: "Disco Elysium", year: 2019, creator: "ZA/UM", genres: ["rpg", "mystery", "drama"], status: "completed", rating: 10 },
  { type: "game", title: "Hades", year: 2020, creator: "Supergiant Games", genres: ["action", "roguelike"], status: "completed", rating: 9 },
  { type: "game", title: "Elden Ring", year: 2022, creator: "FromSoftware", genres: ["action", "rpg", "fantasy"], status: "in_progress", rating: 8, progress: 60 },
];

export function seedSampleLibrary(): number {
  if (listEntries().length > 0) return 0;
  for (const s of SAMPLE) {
    createEntry({
      source: "manual",
      progress: 0,
      ...s,
    } as EntryInput);
  }
  return SAMPLE.length;
}
