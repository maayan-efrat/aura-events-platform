"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { EventContentPayload } from "@/lib/types";

interface EventDescriptionGeneratorProps {
  title: string;
  onTitleChange: (title: string) => void;
  content: EventContentPayload | null;
  onGenerated: (content: EventContentPayload) => void;
}

const textAreaClassName =
  "rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary";

export function EventDescriptionGenerator({ title, onTitleChange, content, onGenerated }: EventDescriptionGeneratorProps) {
  const [bulletsText, setBulletsText] = useState("");
  const [tone, setTone] = useState("");
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
        body: JSON.stringify({ eventTitle: title, bullets, tone: tone || undefined }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message ?? "לא ניתן היה ליצור תוכן כרגע.");
        return;
      }

      onGenerated(data as EventContentPayload);
    } catch {
      setError("לא ניתן להתחבר לשרת. נסו שוב מאוחר יותר.");
    } finally {
      setIsLoading(false);
    }
  }

  function updateField(field: keyof EventContentPayload, value: string) {
    if (!content) return;
    onGenerated({ ...content, [field]: value });
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <form onSubmit={handleGenerate} className="flex flex-col gap-4">
        <Input
          label="שם האירוע"
          required
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
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
            className={textAreaClassName}
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
          {content ? "צור מחדש עם AI" : "יצירת תוכן עם AI"}
        </Button>
      </form>

      <div className="rounded-2xl border border-dashed border-border p-6">
        <h3 className="text-sm font-semibold text-muted-foreground">תוכן שנוצר — ניתן לעריכה לפני פרסום</h3>

        {!content ? (
          <p className="mt-4 text-sm text-muted-foreground">
            התוכן שייווצר יופיע כאן, וניתן יהיה לערוך אותו לפני שהוא מתפרסם ב-Umbraco יחד עם
            שאר פרטי האירוע.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4 text-sm">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="summary" className="font-semibold text-foreground">
                תקציר (summary)
              </label>
              <textarea
                id="summary"
                rows={2}
                value={content.summary}
                onChange={(event) => updateField("summary", event.target.value)}
                className={textAreaClassName}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="description" className="font-semibold text-foreground">
                תיאור מלא (description)
              </label>
              <textarea
                id="description"
                rows={5}
                value={content.description}
                onChange={(event) => updateField("description", event.target.value)}
                className={textAreaClassName}
              />
            </div>
            <Input
              label="כותרת SEO (seoTitle)"
              value={content.seoTitle}
              onChange={(event) => updateField("seoTitle", event.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="seoDescription" className="font-semibold text-foreground">
                תיאור SEO (seoDescription)
              </label>
              <textarea
                id="seoDescription"
                rows={2}
                value={content.seoDescription}
                onChange={(event) => updateField("seoDescription", event.target.value)}
                className={textAreaClassName}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
