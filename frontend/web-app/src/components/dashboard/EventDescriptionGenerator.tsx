"use client";

import { useRef, useState, type FormEvent } from "react";
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

const TYPED_FIELDS: (keyof EventContentPayload)[] = ["summary", "description", "seoTitle", "seoDescription"];
const EMPTY_CONTENT: EventContentPayload = { summary: "", description: "", seoTitle: "", seoDescription: "" };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function EventDescriptionGenerator({ title, onTitleChange, content, onGenerated }: EventDescriptionGeneratorProps) {
  const [bulletsText, setBulletsText] = useState("");
  const [tone, setTone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Typewriter state — content "written" into the fields, one word at a time, right after
  // generation. typingField tracks which field currently shows the blinking cursor.
  const [displayedContent, setDisplayedContent] = useState<EventContentPayload | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingField, setTypingField] = useState<keyof EventContentPayload | null>(null);
  const typingRunRef = useRef(0);

  async function playTypewriter(target: EventContentPayload) {
    const runId = ++typingRunRef.current;
    setIsTyping(true);
    setDisplayedContent(EMPTY_CONTENT);

    let acc = EMPTY_CONTENT;
    for (const field of TYPED_FIELDS) {
      setTypingField(field);
      const words = (target[field] ?? "").split(" ");
      let soFar = "";
      for (const word of words) {
        if (typingRunRef.current !== runId) return; // a newer generation superseded this one
        soFar = soFar ? `${soFar} ${word}` : word;
        acc = { ...acc, [field]: soFar };
        setDisplayedContent(acc);
        await sleep(35);
      }
    }

    if (typingRunRef.current === runId) {
      setIsTyping(false);
      setTypingField(null);
    }
  }

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
      playTypewriter(data as EventContentPayload);
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

  const fieldValue = (field: keyof EventContentPayload) => (isTyping ? displayedContent?.[field] ?? "" : content?.[field] ?? "");

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
          <span aria-hidden="true" className={isLoading ? "animate-sparkle-pulse" : undefined}>
            ✨
          </span>
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
                {typingField === "summary" && <span className="ms-1 animate-blink text-primary">▍</span>}
              </label>
              <textarea
                id="summary"
                rows={2}
                readOnly={isTyping}
                value={fieldValue("summary")}
                onChange={(event) => updateField("summary", event.target.value)}
                className={textAreaClassName}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="description" className="font-semibold text-foreground">
                תיאור מלא (description)
                {typingField === "description" && <span className="ms-1 animate-blink text-primary">▍</span>}
              </label>
              <textarea
                id="description"
                rows={5}
                readOnly={isTyping}
                value={fieldValue("description")}
                onChange={(event) => updateField("description", event.target.value)}
                className={textAreaClassName}
              />
            </div>
            <Input
              label={typingField === "seoTitle" ? "כותרת SEO (seoTitle) ▍" : "כותרת SEO (seoTitle)"}
              readOnly={isTyping}
              value={fieldValue("seoTitle")}
              onChange={(event) => updateField("seoTitle", event.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="seoDescription" className="font-semibold text-foreground">
                תיאור SEO (seoDescription)
                {typingField === "seoDescription" && <span className="ms-1 animate-blink text-primary">▍</span>}
              </label>
              <textarea
                id="seoDescription"
                rows={2}
                readOnly={isTyping}
                value={fieldValue("seoDescription")}
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
