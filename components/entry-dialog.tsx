"use client";

import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { GenreChips } from "@/components/genre-chips";
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
import { Textarea } from "@/components/ui/textarea";
import {
  STATUSES,
  TYPE_META,
  statusLabel,
  type Entry,
  type Status,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export function EntryDialog({
  entry,
  onClose,
}: {
  entry: Entry | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={entry !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {entry && <EntryForm key={entry.id} entry={entry} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function EntryForm({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(entry.status);
  const [rating, setRating] = useState<number | null>(entry.rating);
  const [progress, setProgress] = useState(entry.progress);
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const unit = TYPE_META[entry.type].unit;

  async function request(method: "PATCH" | "DELETE", body?: unknown) {
    setBusy(true);
    try {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Request failed");
      router.refresh();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{entry.title}</DialogTitle>
        <DialogDescription>
          {[TYPE_META[entry.type].label, entry.year, entry.creator]
            .filter(Boolean)
            .join(" · ")}
        </DialogDescription>
      </DialogHeader>

      <div className="flex gap-4">
        <Poster
          title={entry.title}
          type={entry.type}
          src={entry.posterUrl}
          className="w-24 shrink-0 self-start"
        />
        <div className="min-w-0 space-y-2">
          <GenreChips genres={entry.genres} max={6} />
          {entry.overview && (
            <p className="line-clamp-5 text-xs leading-relaxed text-muted-foreground">
              {entry.overview}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="e-status">Status</Label>
          <NativeSelect
            id="e-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(entry.type, s)}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-1.5">
          <Label id="rating-label">
            Rating {rating ? <span className="text-muted-foreground">· {rating}/10</span> : null}
          </Label>
          <div className="flex flex-wrap gap-1" role="group" aria-labelledby="rating-label">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={rating === n}
                onClick={() => setRating(rating === n ? null : n)}
                className={cn(
                  "size-8 rounded-md border text-sm tabular-nums transition-colors",
                  rating !== null && n <= rating
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="e-progress">Progress ({unit})</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Decrease progress"
              onClick={() => setProgress((p) => Math.max(0, p - 1))}
            >
              <Minus aria-hidden />
            </Button>
            <Input
              id="e-progress"
              type="number"
              min={0}
              value={progress}
              onChange={(e) => setProgress(Math.max(0, Number(e.target.value) || 0))}
              className="w-24 text-center tabular-nums"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Increase progress"
              onClick={() => setProgress((p) => p + 1)}
            >
              <Plus aria-hidden />
            </Button>
            {entry.total ? (
              <span className="text-sm text-muted-foreground">/ {entry.total}</span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="e-notes">Notes</Label>
          <Textarea
            id="e-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What did you think?"
            rows={3}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (await request("DELETE")) {
                  toast.success(`Removed "${entry.title}"`);
                  onClose();
                }
              }}
            >
              Confirm remove
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden /> Remove
          </Button>
        )}
        <Button
          disabled={busy}
          onClick={async () => {
            const ok = await request("PATCH", {
              status,
              rating,
              progress,
              notes: notes.trim() || null,
            });
            if (ok) {
              toast.success("Saved");
              onClose();
            }
          }}
        >
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          Save
        </Button>
      </div>
    </>
  );
}
