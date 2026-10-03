import { Badge } from "@/components/ui/badge";
import { titleCaseGenre } from "@/lib/genres";

export function GenreChips({ genres, max = 4 }: { genres: string[]; max?: number }) {
  if (!genres.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {genres.slice(0, max).map((g) => (
        <Badge key={g} variant="secondary" className="font-normal">
          {titleCaseGenre(g)}
        </Badge>
      ))}
    </div>
  );
}
