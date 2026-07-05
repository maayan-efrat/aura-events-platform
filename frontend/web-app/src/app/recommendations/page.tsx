import { redirect } from "next/navigation";
import { callEventsApiAsCurrentUser, getCurrentUser } from "@/lib/backend-fetch";
import { getPublishedEventContent } from "@/lib/umbraco";
import { AiRecommendations } from "@/components/dashboard/AiRecommendations";
import type { AiRecommendationHistoryEntry } from "@/lib/types";

export const metadata = { title: "המלצות AI — AuraEvents" };

export default async function RecommendationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [eventContent, historyResponse] = await Promise.all([
    getPublishedEventContent().catch(() => []),
    callEventsApiAsCurrentUser("/api/events/ai/recommendations/history").catch(() => null),
  ]);
  const slugByEventId = Object.fromEntries(eventContent.map((item) => [item.systemEventId, item.slug]));
  const initialHistory: AiRecommendationHistoryEntry[] = historyResponse?.ok ? await historyResponse.json() : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
        <span aria-hidden="true">✨</span>
        המלצות מותאמות אישית
      </h1>
      <p className="mt-1 text-muted-foreground">מבוסס על היסטוריית ההרשמות שלך ותחומי העניין שתשתפו.</p>

      <div className="mt-8">
        <AiRecommendations slugByEventId={slugByEventId} initialHistory={initialHistory} />
      </div>
    </div>
  );
}
