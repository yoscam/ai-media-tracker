"use client";

import { Search, Sparkles, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { OPEN_ADD_EVENT } from "@/components/add-media-dialog";
import { EntryDialog } from "@/components/entry-dialog";
import { MediaIcon } from "@/components/media-icon";
import { NativeSelect } from "@/components/native-select";
import { Poster } from "@/components/poster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MEDIA_TYPES,
  STATUSES,
  STATUS_LABEL,
  TYPE_META,
  statusLabel,
  type Entry,
  type MediaType,
  type Status,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Sort = "updated" | "title" | "rating" | "year";

const STATUS_STYLE: Record<Status, string> = {
  planning: "bg-sky-500/20 text-sky-200",
  in_progress: "bg-violet-500/25 text-violet-100",
  completed: "bg-emerald-500/20 text-emerald-200",
  paused: "bg-amber-500/20 text-amber-200",
  dropped: "bg-rose-500/20 text-rose-200",
};

export function LibraryView({ entries }: { entries: Entry[] }) {
  const router = useRouter();
  const [type, setType] = useState<MediaType | "all">("all");
  const [status, setStatus] = useState<Status | "all">("all");
  const [text, setText] = useState("");
  const [sort, setSort] = useState<Sort>("updated");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);

  const counts = useMemo(() => {
    const c = new Map<MediaType, number>();
    for (const e of entries) c.set(e.type, (c.get(e.type) ?? 0) + 1);
    return c;
  }, [entries]);

  const visible = useMemo(() => {
    const q = text.trim().toLowerCase();
    const list = entries.filter(
      (e) =>
        (type === "all" || e.type === type) &&
        (status === "all" || e.status === status) &&
        (!q ||
          e.title.toLowerCase().includes(q) ||
          e.creator?.toLowerCase().includes(q) ||
          e.genres.some((g) => g.includes(q))),
    );
    const sorters: Record<Sort, (a: Entry, b: Entry) => number> = {
      updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      title: (a, b) => a.title.localeCompare(b.title),
      rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1),
      year: (a, b) => (b.year ?? 0) - (a.year ?? 0),
    };
    return [...list].sort(sorters[sort]);
  }, [entries, type, status, text, sort]);

  const selected = entries.find((e) => e.id === selectedId) ?? null;

  const rated = entries.filter((e) => e.rating != null);
  const stats = [
    { label: "Titles", value: entries.length },
    { label: "In progress", value: entries.filter((e) => e.status === "in_progress").length },
    { label: "Completed", value: entries.filter((e) => e.status === "completed").length },
    {
      label: "Average rating",
      value: rated.length
        ? (rated.reduce((s, e) => s + e.rating!, 0) / rated.length).toFixed(1)
        : "–",
    },
  ];

  if (entries.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Sparkles className="size-7" aria-hidden />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Your shelf is empty</h1>
        <p className="text-muted-foreground">
          Track what you watch, read and play. Rate a few favourites and MediaShelf
          will learn your taste and suggest what to try next.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => window.dispatchEvent(new Event(OPEN_ADD_EVENT))}>
            Add your first title
          </Button>
          <Button
            variant="outline"
            disabled={seeding}
            onClick={async () => {
              setSeeding(true);
              const res = await fetch("/api/seed", { method: "POST" });
              setSeeding(false);
              if (!res.ok) return toast.error("Could not load the sample library");
              toast.success("Loaded a sample library to explore");
              router.refresh();
            }}
          >
            Load sample library
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card px-4 py-3">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by type">
          <TypeTab active={type === "all"} onClick={() => setType("all")}>
            All <span className="text-muted-foreground">{entries.length}</span>
          </TypeTab>
          {MEDIA_TYPES.filter((t) => counts.has(t)).map((t) => (
            <TypeTab key={t} active={type === t} onClick={() => setType(t)}>
              <MediaIcon type={t} className="size-3.5" />
              {TYPE_META[t].plural}
              <span className="text-muted-foreground">{counts.get(t)}</span>
            </TypeTab>
          ))}
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
          <div className="relative min-w-40 flex-1 lg:max-w-60">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Filter your library"
              aria-label="Filter your library"
              className="pl-8"
            />
          </div>
          <NativeSelect
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status | "all")}
          >
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Sort by"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
          >
            <option value="updated">Recently updated</option>
            <option value="title">Title</option>
            <option value="rating">Rating</option>
            <option value="year">Year</option>
          </NativeSelect>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          Nothing matches those filters.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {visible.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => setSelectedId(e.id)}
                className="group w-full text-left outline-none"
                aria-label={`Open ${e.title}`}
              >
                <div className="relative overflow-hidden rounded-lg ring-offset-background transition-transform group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                  <Poster title={e.title} type={e.type} src={e.posterUrl} />
                  <Badge
                    className={cn(
                      "absolute top-2 left-2 border-0 backdrop-blur",
                      STATUS_STYLE[e.status],
                    )}
                  >
                    {statusLabel(e.type, e.status)}
                  </Badge>
                  {e.rating != null && (
                    <span className="absolute top-2 right-2 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-xs font-medium text-amber-300 backdrop-blur">
                      <Star className="size-3 fill-current" aria-hidden />
                      {e.rating}
                    </span>
                  )}
                  {e.status === "in_progress" && e.total ? (
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.min(100, (e.progress / e.total) * 100)}%` }}
                      />
                    </div>
                  ) : null}
                </div>
                <p className="mt-2 truncate text-sm font-medium">{e.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[TYPE_META[e.type].label, e.year].filter(Boolean).join(" · ")}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <EntryDialog entry={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function TypeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
