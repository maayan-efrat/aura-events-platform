"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/Card";

interface Recommendation {
  eventId: string;
  title: string;
  startAtUtc: string;
  reason: string;
}

export function AiRecommendations() {
  const [preferences, setPreferences] = useState("");
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch {
      setError("לא ניתן להתחבר לשרת. נסו שוב מאוחר יותר.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={preferences}
          onChange={(event) => setPreferences(event.target.value)}
          placeholder="ספרו לנו על תחומי עניין (לדוגמה: AI, עיצוב, נטוורקינג)..."
          className="h-11 flex-1 rounded-xl border border-border bg-surface px-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary"
        />
        <Button onClick={handleGetRecommendations} isLoading={isLoading} className="shrink-0">
          קבלו המלצות AI
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      {recommendations && recommendations.length === 0 && (
        <p className="text-sm text-muted-foreground">לא נמצאו המלצות מתאימות כרגע.</p>
      )}

      {recommendations && recommendations.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {recommendations.map((rec) => (
            <li key={rec.eventId} className="list-none">
              <Card>
                <CardContent>
                  <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    <span aria-hidden="true">✨</span>
                    המלצת AI
                  </span>
                  <CardTitle>{rec.title}</CardTitle>
                  <CardDescription>{rec.reason}</CardDescription>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
