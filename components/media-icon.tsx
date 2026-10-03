import {
  BookOpen,
  Clapperboard,
  Gamepad2,
  Film,
  Library,
  Tv,
  type LucideIcon,
} from "lucide-react";
import type { MediaType } from "@/lib/types";

const ICONS: Record<MediaType, LucideIcon> = {
  movie: Film,
  tv: Tv,
  anime: Clapperboard,
  manga: Library,
  book: BookOpen,
  game: Gamepad2,
};

export function MediaIcon({
  type,
  className,
}: {
  type: MediaType;
  className?: string;
}) {
  const Icon = ICONS[type];
  return <Icon className={className} aria-hidden />;
}
