import { LibraryView } from "@/components/library-view";
import { listEntries } from "@/lib/entries";

export const dynamic = "force-dynamic";

export default function LibraryPage() {
  return <LibraryView entries={listEntries()} />;
}
