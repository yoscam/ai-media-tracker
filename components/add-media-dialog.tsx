"use client";

import { Check, Loader2, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { GenreChips } from "@/components/genre-chips";
import { MediaIcon } from "@/components/media-icon";
import { NativeSelect } from "@/components/native-select";
import { Poster } from "@/components/poster";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MEDIA_TYPES,
  STATUSES,
  TYPE_META,
  statusLabel,
  type Candidate,
  type MediaType,
  type Status,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export const OPEN_ADD_EVENT = "mediashelf:open-add";

export function AddMediaDialog({
  searchable,
}: {
  searchable: Record<string, boolean>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<MediaType>("anime");
  const [status, setStatus] = useState<Status>("planning");
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState<{
    key: string;
    results?: Candidate[];
    error?: string;
  } | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState(false);

  const canSearch = searchable[type];

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_ADD_EVENT, handler);
    return () => window.removeEventListener(OPEN_ADD_EVENT, handler);
  }, []);

  const trimmed = query.trim();
  const eligible = canSearch && trimmed.length >= 2;
  const searchKey = `${type}|${trimmed}`;
  const current = outcome?.key === searchKey ? outcome : null;
  const loading = eligible && !current;
  const results = current?.results ?? null;
  const error = current?.error ?? null;

  useEffect(() => {
    if (!eligible) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?type=${type}&q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Search failed");
        setOutcome({ key: searchKey, results: json.results });
      } catch (err) {
        if (controller.signal.aborted) return;
        setOutcome({
          key: searchKey,
          error: err instanceof Error ? err.message : "Search failed",
        });
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [eligible, type, trimmed, searchKey]);

  const save = useCallback(
    async (payload: object, key: string) => {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, status }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not add title");
        return false;
      }
      setAdded((prev) => new Set(prev).add(key));
      toast.success(`Added "${json.title}" as ${statusLabel(json.type, status).toLowerCase()}`);
      router.refresh();
      return true;
    },
    [router, status],
  );

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Add
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add to your library</DialogTitle>
            <DialogDescription>
              Search a metadata provider, or add a title by hand.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Media type">
            {MEDIA_TYPES.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={type === t}
                onClick={() => {
                  setType(t);
                  setManual(false);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  type === t
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <MediaIcon type={t} className="size-3.5" />
                {TYPE_META[t].plural}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="add-status" className="text-muted-foreground">
              Add as
            </Label>
            <NativeSelect
              id="add-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(type, s)}
                </option>
              ))}
            </NativeSelect>
            <Button
              variant={manual || !canSearch ? "secondary" : "ghost"}
              size="sm"
              className="ml-auto"
              disabled={!canSearch}
              onClick={() => setManual((m) => !m)}
            >
              {manual ? "Back to search" : "Add manually"}
            </Button>
          </div>

          {canSearch && !manual ? (
            <>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${TYPE_META[type].plural.toLowerCase()}…`}
                  className="pl-8"
                  aria-label="Search title"
                />
              </div>
              <div className="min-h-32 flex-1 overflow-y-auto">
                {loading && (
                  <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden /> Searching…
                  </p>
                )}
                {error && (
                  <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    {error}. You can still add it manually.
                  </p>
                )}
                {!loading && !error && results === null && (
                  <p className="p-3 text-sm text-muted-foreground">
                    Type at least two characters to search.
                  </p>
                )}
                {results?.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">
                    No matches for “{query}”. Try another spelling or add it manually.
                  </p>
                )}
                <ul className="flex flex-col gap-1">
                  {results?.map((c) => {
                    const key = `${c.source}:${c.externalId}`;
                    const done = added.has(key);
                    return (
                      <li
                        key={key}
                        className="flex gap-3 rounded-lg p-2 hover:bg-muted/60"
                      >
                        <Poster
                          title={c.title}
                          type={c.type}
                          src={c.posterUrl}
                          className="w-12 shrink-0"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="truncate font-medium">{c.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[c.year, c.creator].filter(Boolean).join(" · ")}
                          </p>
                          <GenreChips genres={c.genres} max={3} />
                        </div>
                        <Button
                          size="sm"
                          variant={done ? "secondary" : "default"}
                          disabled={done}
                          onClick={() => save(c, key)}
                          className="self-center"
                        >
                          {done ? <Check aria-hidden /> : <Plus aria-hidden />}
                          {done ? "Added" : "Add"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          ) : (
            <ManualForm
              type={type}
              notice={
                canSearch
                  ? null
                  : "There is no game metadata provider yet, so games are added by hand."
              }
              onSubmit={async (payload) => {
                const ok = await save(payload, `manual:${payload.title}`);
                return ok;
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ManualForm({
  type,
  notice,
  onSubmit,
}: {
  type: MediaType;
  notice: string | null;
  onSubmit: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        const year = Number(data.get("year"));
        const rating = Number(data.get("rating"));
        setBusy(true);
        const ok = await onSubmit({
          type,
          source: "manual",
          title: String(data.get("title")).trim(),
          creator: String(data.get("creator") || "").trim() || null,
          year: year || null,
          rating: rating || null,
          genres: String(data.get("genres") || "")
            .split(",")
            .map((g) => g.trim())
            .filter(Boolean),
        });
        setBusy(false);
        if (ok) form.reset();
      }}
    >
      {notice && (
        <p className="rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">{notice}</p>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="m-title">Title</Label>
        <Input id="m-title" name="title" required maxLength={300} autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="m-creator">Creator / studio</Label>
          <Input id="m-creator" name="creator" maxLength={300} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="m-year">Year</Label>
          <Input id="m-year" name="year" type="number" min={1800} max={2200} />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="m-genres">Genres (comma separated)</Label>
          <Input id="m-genres" name="genres" placeholder="sci-fi, mystery" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="m-rating">Rating</Label>
          <Input id="m-rating" name="rating" type="number" min={1} max={10} placeholder="1-10" />
        </div>
      </div>
      <Button type="submit" disabled={busy} className="justify-self-end">
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
        Add {TYPE_META[type].label.toLowerCase()}
      </Button>
    </form>
  );
}
