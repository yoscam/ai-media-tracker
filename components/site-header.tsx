"use client";

import { Sparkles, Library, Download, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AddMediaDialog } from "@/components/add-media-dialog";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Library", icon: Library },
  { href: "/recommendations", label: "For you", icon: Sparkles },
];

export function SiteHeader({ searchable }: { searchable: Record<string, boolean> }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="mr-2 flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Library className="size-4" aria-hidden />
          </span>
          <span className="hidden sm:inline">MediaShelf</span>
        </Link>
        <nav className="flex items-center gap-1" aria-label="Main">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                  active && "bg-muted text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <SyncButton />
          <a
            href="/api/export"
            className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:flex"
            title="Download your library as JSON"
          >
            <Download className="size-4" aria-hidden />
            Export
          </a>
          <AddMediaDialog searchable={searchable} />
        </div>
      </div>
    </header>
  );
}

function SyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch("/api/sync", { method: "POST" });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Sync failed");
          const parts = [`${json.updated} of ${json.checked} titles updated`];
          if (json.unmatched.length) parts.push(`no match: ${json.unmatched.join(", ")}`);
          if (json.skipped) parts.push(`${json.skipped} skipped (provider unreachable)`);
          toast.success(json.checked ? parts.join(" · ") : "Everything is already synced");
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Sync failed");
        } finally {
          setBusy(false);
        }
      }}
      className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60 md:flex"
      title="Fill in posters, genres and descriptions for hand-added titles"
    >
      <RefreshCw className={cn("size-4", busy && "animate-spin")} aria-hidden />
      {busy ? "Syncing…" : "Sync"}
    </button>
  );
}
