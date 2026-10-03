import { RecommendationsView } from "@/components/recommendations-view";
import { aiConfig, listRecommendations } from "@/lib/recommendations";
import { buildTaste } from "@/lib/taste";

export const dynamic = "force-dynamic";

export default function RecommendationsPage() {
  const { configured, model } = aiConfig();
  return (
    <RecommendationsView
      initial={listRecommendations()}
      taste={buildTaste()}
      ai={{ configured, model }}
    />
  );
}
