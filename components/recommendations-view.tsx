"use client";

import { Bot, Info, Loader2, Plus, Sparkles, ThumbsDown, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { GenreChips } from "@/components/genre-chips";
import { MediaIcon } from "@/components/media-icon";
import { NativeSelect } from "@/components/native-select";
import { Poster } from "@/components/poster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { titleCaseGenre } from "@/lib/genres";
import {
  MEDIA_TYPES,
  TYPE_META,
  type MediaType,
  type Recommendation,
  type TasteProfile,
} from "@/lib/types";

interface Props {
  initial: Recommendation[];
  taste: TasteProfile;
  ai: { configured: boolean; model: string };
}

export function RecommendationsView({ initial, taste, ai }: Props) {
  const router = useRouter();
  const [recs, setRecs] = useState(initial);
  const [type, setType] = useState<MediaType | "all">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<"ai" | "local" | null>(initial[0]?.origin ?? null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const trackedTypes = taste.byType.map((b) => b.type);
  const maxScore = Math.max(0.01, ...taste.topGenres.map((g) => g.score));

  async function generate() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, count: 8 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not generate recommendations");
      setRecs(json.recommendations);
      setMode(json.mode);
      setNotice(json.notice);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate recommendations");
    } finally {
      setLoading(false);
    }
  }

  async function accept(rec: Recommendation) {
    setBusyId(rec.id);
    const res = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: rec.type,
        title: rec.title,
        year: rec.year,
        creator: rec.creator,
        posterUrl: rec.posterUrl,
        overview: rec.overview,
        genres: rec.genres,
        source: rec.source,
        externalId: rec.externalId,
        total: rec.total,
        status: "planning",
        fromRecommendation: rec.id,
      }),
    });
    setBusyId(null);
    const json = await res.json();
    if (!res.ok) return toast.error(json.error ?? "Could not add title");
    setRecs((r) => r.filter((x) => x.id !== rec.id));
    toast.success(`"${rec.title}" added to Planning`);
    router.refresh();
  }

  async function dismiss(rec: Recommendation) {
    setBusyId(rec.id);
    await fetch(`/api/recommendations/${rec.id}`, { method: "DELETE" });
    setBusyId(null);
    setRecs((r) => r.filter((x) => x.id !== rec.id));
    toast("Got it. We won't suggest that again.");
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[19rem_1fr]">
      <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" aria-hidden /> Your taste
          </h2>
          {taste.summary && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{taste.summary}</p>
          )}
          {taste.signal === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Rate or complete a few titles and your taste profile will appear here.
            </p>
          ) : (
            <>
              <ul className="mt-3 space-y-2" aria-label="Top genres">
                {taste.topGenres.slice(0, 7).map((g) => (
                  <li key={g.name} className="text-xs">
                    <div className="mb-1 flex justify-between">
                      <span>{titleCaseGenre(g.name)}</span>
                      <span className="text-muted-foreground">
                        {g.avgRating ? `avg ${g.avgRating}` : `${g.count} titles`}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(8, (g.score / maxScore) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              {taste.avoidGenres.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-xs text-muted-foreground">Not really your thing</p>
                  <div className="flex flex-wrap gap-1">
                    {taste.avoidGenres.map((g) => (
                      <Badge key={g.name} variant="outline" className="font-normal">
                        {titleCaseGenre(g.name)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {taste.favoriteCreators.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-xs text-muted-foreground">Creators you keep coming back to</p>
                  <p className="text-sm">{taste.favoriteCreators.map((c) => c.name).join(", ")}</p>
                </div>
              )}
              {taste.signal < 5 && (
                <p className="mt-4 flex gap-2 rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  Only {taste.signal} rated or finished title{taste.signal === 1 ? "" : "s"} so far.
                  Rate more for sharper suggestions.
                </p>
              )}
            </>
          )}
        </section>

        <section className="rounded-xl border bg-card p-4 text-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Bot className="size-4 text-primary" aria-hidden /> Recommendation engine
          </h2>
          {ai.configured ? (
            <p className="mt-2 text-muted-foreground">
              Using <code className="rounded bg-muted px-1 py-0.5 text-xs">{ai.model}</code> to
              reason about your taste. Picks are checked against metadata providers where
              possible.
            </p>
          ) : (
            <p className="mt-2 text-muted-foreground">
              Running in local mode: picks are ranked by your genre taste. Set{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">AI_API_KEY</code> (or point{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">AI_BASE_URL</code> at Ollama)
              for explanations that reference what you loved.
            </p>
          )}
        </section>
      </aside>

      <section aria-live="polite">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <h1 className="text-2xl font-semibold tracking-tight">Recommended for you</h1>
            <p className="text-sm text-muted-foreground">
              {mode === "ai"
                ? "Hand-picked by your AI model from your ratings."
                : mode === "local"
                  ? "Matched to your favourite genres."
                  : "Fresh picks based on what you have rated."}
            </p>
          </div>
          <NativeSelect
            aria-label="Media type to recommend"
            value={type}
            onChange={(e) => setType(e.target.value as MediaType | "all")}
          >
            <option value="all">Everything I track</option>
            {MEDIA_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_META[t].plural}
                {trackedTypes.includes(t) ? "" : " (new)"}
              </option>
            ))}
          </NativeSelect>
          <Button onClick={generate} disabled={loading || taste.signal === 0}>
            {loading ? <Loader2 className="animate-spin" aria-hidden /> : <Wand2 aria-hidden />}
            {recs.length ? "Refresh picks" : "Get recommendations"}
          </Button>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {notice && !error && (
          <p className="mb-4 flex gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {notice}
          </p>
        )}

        {loading ? (
          <ul className="grid gap-4 sm:grid-cols-2" aria-busy>
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="flex gap-4 rounded-xl border bg-card p-3">
                <Skeleton className="aspect-[2/3] w-24 shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
              </li>
            ))}
          </ul>
        ) : recs.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center">
            <Sparkles className="mx-auto size-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 font-medium">No recommendations yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              {taste.signal === 0
                ? "Rate or finish a few titles in your library first."
                : "Pick a media type and generate your first batch."}
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {recs.map((rec) => (
              <li
                key={rec.id}
                className="flex gap-4 rounded-xl border bg-card p-3 transition-colors hover:border-primary/40"
              >
                <Poster
                  title={rec.title}
                  type={rec.type}
                  src={rec.posterUrl}
                  className="w-24 shrink-0 self-start"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div>
                    <h3 className="truncate font-semibold">{rec.title}</h3>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MediaIcon type={rec.type} className="size-3.5" />
                      {[TYPE_META[rec.type].label, rec.year, rec.creator].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <GenreChips genres={rec.genres} max={3} />
                  <p className="text-sm leading-snug text-muted-foreground">{rec.reason}</p>
                  <div className="mt-auto flex gap-2 pt-1">
                    <Button size="sm" disabled={busyId === rec.id} onClick={() => accept(rec)}>
                      <Plus aria-hidden /> Plan it
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === rec.id}
                      onClick={() => dismiss(rec)}
                      aria-label={`Not interested in ${rec.title}`}
                    >
                      <ThumbsDown aria-hidden /> Not for me
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
