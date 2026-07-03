"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface GeneratedDescription {
  summary: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
}

export function EventDescriptionGenerator() {
  const [eventTitle, setEventTitle] = useState("");
  const [bulletsText, setBulletsText] = useState("");
  const [tone, setTone] = useState("");
  const [result, setResult] = useState<GeneratedDescription | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const bullets = bulletsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    try {
      const response = await fetch("/api/ai/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventTitle, bullets, tone: tone || undefined }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message ?? "לא ניתן היה ליצור תוכן כרגע.");
        return;
      }

      setResult(data);
    } catch {
      setError("לא ניתן להתחבר לשרת. נסו שוב מאוחר יותר.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <form onSubmit={handleGenerate} className="flex flex-col gap-4">
        <Input
          label="שם האירוע"
          required
          value={eventTitle}
          onChange={(event) => setEventTitle(event.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="bullets" className="text-sm font-medium text-foreground">
            נקודות עיקריות (שורה לכל נקודה)
          </label>
          <textarea
            id="bullets"
            required
            rows={6}
            value={bulletsText}
            onChange={(event) => setBulletsText(event.target.value)}
            placeholder={"לדוגמה:\nכנס בן יומיים\n20 הרצאות מובילי תעשייה\nסדנאות מעשיות"}
            className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary"
          />
        </div>

        <Input
          label="טון (אופציונלי)"
          placeholder="מקצועי, נלהב, רשמי..."
          value={tone}
          onChange={(event) => setTone(event.target.value)}
        />

        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}

        <Button type="submit" isLoading={isLoading} className="mt-2">
          יצירת תוכן עם AI
        </Button>
      </form>

      <div className="rounded-2xl border border-dashed border-border p-6">
        <h3 className="text-sm font-semibold text-muted-foreground">
          תוכן שנוצר — להעתקה לשדות Umbraco
        </h3>

        {!result ? (
          <p className="mt-4 text-sm text-muted-foreground">
            התוכן שייווצר יופיע כאן, מוכן להעתקה לשדות summary / description / seoTitle /
            seoDescription בעורך התוכן של Umbraco.
          </p>
        ) : (
          <dl className="mt-4 flex flex-col gap-4 text-sm">
            <div>
              <dt className="font-semibold text-foreground">תקציר (summary)</dt>
              <dd className="mt-1 text-muted-foreground">{result.summary}</dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground">תיאור מלא (description)</dt>
              <dd className="mt-1 whitespace-pre-line text-muted-foreground">{result.description}</dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground">כותרת SEO (seoTitle)</dt>
              <dd className="mt-1 text-muted-foreground">{result.seoTitle}</dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground">תיאור SEO (seoDescription)</dt>
              <dd className="mt-1 text-muted-foreground">{result.seoDescription}</dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
