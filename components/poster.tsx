/* eslint-disable @next/next/no-img-element */
import { MediaIcon } from "@/components/media-icon";
import { cn } from "@/lib/utils";
import type { MediaType } from "@/lib/types";

function hue(title: string) {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function Poster({
  title,
  type,
  src,
  className,
}: {
  title: string;
  type: MediaType;
  src: string | null;
  className?: string;
}) {
  const h = hue(title);
  return (
    <div
      className={cn(
        "relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-muted",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(160deg, hsl(${h} 45% 28%), hsl(${(h + 50) % 360} 50% 14%))`,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={`Cover of ${title}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-white/80">
          <MediaIcon type={type} className="size-7 opacity-70" />
          <span className="line-clamp-4 text-xs font-medium leading-snug">
            {title}
          </span>
        </div>
      )}
    </div>
  );
}
