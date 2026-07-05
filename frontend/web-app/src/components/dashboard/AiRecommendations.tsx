"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/Card";
import { RegisterButton } from "@/components/events/RegisterButton";
import type { AiRecommendationHistoryEntry, RecommendedEvent } from "@/lib/types";

const historyDateFormatter = new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" });

function RecommendationCards({
  recommendations,
  slugByEventId,
}: {
  recommendations: RecommendedEvent[];
  slugByEventId: Record<string, string>;
}) {
  if (recommendations.length === 0) {
    return <p className="text-sm text-muted-foreground">לא נמצאו המלצות מתאימות כרגע.</p>;
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {recommendations.map((rec, index) => {
        const slug = slugByEventId[rec.eventId];
        return (
          <li key={rec.eventId} className="list-none animate-fade-in-up" style={{ animationDelay: `${index * 80}ms` }}>
            <Card>
              <CardContent>
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <span aria-hidden="true">✨</span>
                  המלצת AI
                </span>
                {slug ? (
                  <Link href={`/${slug}`} className="hover:text-primary">
                    <CardTitle>{rec.title}</CardTitle>
                  </Link>
                ) : (
                  <CardTitle>{rec.title}</CardTitle>
                )}
                <CardDescription>{rec.reason}</CardDescription>
                <div className="mt-2">
                  <RegisterButton eventId={rec.eventId} isLoggedIn initialStatus={null} />
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

export function AiRecommendations({
  slugByEventId,
  initialHistory = [],
}: {
  slugByEventId: Record<string, string>;
  initialHistory?: AiRecommendationHistoryEntry[];
}) {
  const [preferences, setPreferences] = useState("");
  const [recommendations, setRecommendations] = useState<RecommendedEvent[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AiRecommendationHistoryEntry[]>(initialHistory);

  async function handleGetRecommendations() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: preferences || undefined, maxResults: 5 }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message ?? "לא ניתן היה לקבל המלצות כרגע.");
        return;
      }

      setRecommendations(data.recommendations);
      // Optimistic — the server saves the same row moments later (best-effort), no need to refetch.
      setHistory((current) => [
        {
          id: crypto.randomUUID(),
          preferences: preferences || null,
          recommendations: data.recommendations,
          createdAtUtc: new Date().toISOString(),
        },
        ...current,
      ]);
    } catch {
      setError("לא ניתן להתחבר לשרת. נסו שוב מאוחר יותר.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-surface to-surface p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -end-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <textarea
            value={preferences}
            onChange={(event) => setPreferences(event.target.value)}
            placeholder="ספרו לנו על תחומי עניין (לדוגמה: AI, עיצוב, נטוורקינג)..."
            rows={3}
            className="w-full resize-y rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary"
          />
          <Button onClick={handleGetRecommendations} isLoading={isLoading} className="group self-start overflow-hidden">
            <span aria-hidden="true" className={isLoading ? "animate-sparkle-pulse" : "transition-transform group-hover:rotate-12"}>
              ✨
            </span>
            קבלו המלצות AI
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
            </span>
            ה-AI מחפש התאמות בשבילכם...
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}

        {recommendations && <RecommendationCards recommendations={recommendations} slugByEventId={slugByEventId} />}
      </div>

      {history.length > 0 && (
        <div className="relative mt-8 border-t border-border pt-6">
          <h3 className="text-sm font-semibold text-muted-foreground">היסטוריית המלצות</h3>
          <ul className="mt-4 flex flex-col gap-4">
            {history.map((entry) => (
              <li key={entry.id} className="rounded-xl border border-border bg-surface/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setPreferences(entry.preferences ?? "")}
                    className="text-start text-sm font-medium text-foreground hover:text-primary"
                  >
                    {entry.preferences || "ללא העדפות ספציפיות"}
                  </button>
                  <span className="text-xs text-muted-foreground">{historyDateFormatter.format(new Date(entry.createdAtUtc))}</span>
                </div>
                <div className="mt-3">
                  <RecommendationCards recommendations={entry.recommendations} slugByEventId={slugByEventId} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
