"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { EventDescriptionGenerator } from "@/components/dashboard/EventDescriptionGenerator";
import { CategoryTreePicker } from "@/components/dashboard/CategoryTreePicker";
import { slugify } from "@/lib/slugify";
import { DEFAULT_TIMEZONE, SUPPORTED_TIMEZONES, zonedTimeToUtcIso } from "@/lib/timezone";
import type { Category, CreateEventPayload, CreateEventResponse, EventContentPayload } from "@/lib/types";

const selectClassName =
  "h-11 rounded-xl border border-border bg-surface px-4 text-sm text-foreground focus-visible:border-primary";

/** Strips the "data:image/png;base64," prefix FileReader adds, leaving just the base64 payload. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function NewEventForm({ categories }: { categories: Category[] }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<EventContentPayload | null>(null);

  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [venueName, setVenueName] = useState("");
  const [isVirtual, setIsVirtual] = useState(false);
  const [capacity, setCapacity] = useState("");
  const [price, setPrice] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateEventResponse | null>(null);

  function handleTitleChange(value: string) {
    setTitle(value);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      setSubmitError("יש למלא שם אירוע.");
      return;
    }
    if (!content) {
      setSubmitError("יש ליצור תוכן עם AI לפני יצירת האירוע.");
      return;
    }
    if (!startLocal || !endLocal) {
      setSubmitError("יש למלא את כל שדות החובה (תאריכי התחלה וסיום).");
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    let contentWithImage = content;
    if (heroImageFile) {
      try {
        contentWithImage = {
          ...content,
          heroImageBase64: await fileToBase64(heroImageFile),
          heroImageFileName: heroImageFile.name,
          heroImageContentType: heroImageFile.type || "application/octet-stream",
        };
      } catch {
        setSubmitError("קריאת קובץ התמונה נכשלה. נסו קובץ אחר.");
        setIsSubmitting(false);
        return;
      }
    }

    const payload: CreateEventPayload = {
      title,
      slug: slugify(title),
      startAtUtc: zonedTimeToUtcIso(startLocal, timezone),
      endAtUtc: zonedTimeToUtcIso(endLocal, timezone),
      timezone,
      venueName: isVirtual ? null : venueName || null,
      isVirtual,
      capacity: capacity ? Number(capacity) : null,
      price: price ? Number(price) : null,
      status: "Published",
      umbracoContentKey: null,
      content: contentWithImage,
      categoryIds,
    };

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setSubmitError(data.error?.message ?? "יצירת האירוע נכשלה.");
        return;
      }

      setResult(data as CreateEventResponse);
    } catch {
      setSubmitError("לא ניתן להתחבר לשרת. נסו שוב מאוחר יותר.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRetryPublish() {
    if (!result || !content) return;

    setSubmitError(null);
    setIsRetrying(true);

    try {
      const response = await fetch(`/api/events/${result.eventId}/umbraco-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
      const data = await response.json();

      if (!response.ok) {
        setSubmitError(data.error?.message ?? "הניסיון החוזר נכשל.");
        return;
      }

      setResult(data as CreateEventResponse);
    } catch {
      setSubmitError("לא ניתן להתחבר לשרת. נסו שוב מאוחר יותר.");
    } finally {
      setIsRetrying(false);
    }
  }

  if (result && !result.umbracoSyncError) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <h2 className="text-xl font-semibold text-foreground">האירוע נוצר ופורסם בהצלחה</h2>
        <p className="mt-2 text-muted-foreground">האירוע יופיע בעמוד הבית תוך דקה.</p>
        <Link href="/" className={cn(buttonVariants(), "mt-6")}>
          לעמוד הבית
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <EventDescriptionGenerator
        title={title}
        onTitleChange={handleTitleChange}
        content={content}
        onGenerated={setContent}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <fieldset disabled={!content || Boolean(result)} className="flex flex-col gap-4 rounded-2xl border border-border p-6 disabled:opacity-50">
          <legend className="px-2 text-sm font-semibold text-foreground">פרטי האירוע</legend>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="תאריך ושעת התחלה"
              type="datetime-local"
              required
              value={startLocal}
              onChange={(event) => setStartLocal(event.target.value)}
            />
            <Input
              label="תאריך ושעת סיום"
              type="datetime-local"
              required
              value={endLocal}
              onChange={(event) => setEndLocal(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="timezone" className="text-sm font-medium text-foreground">
              אזור זמן
            </label>
            <select
              id="timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className={selectClassName}
            >
              {SUPPORTED_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={isVirtual} onChange={(event) => setIsVirtual(event.target.checked)} />
            אירוע וירטואלי
          </label>

          {!isVirtual && (
            <Input label="מקום האירוע" value={venueName} onChange={(event) => setVenueName(event.target.value)} />
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="קיבולת (אופציונלי)"
              type="number"
              min={1}
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
            />
            <Input
              label="מחיר בש״ח (ריק = כניסה חופשית)"
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="hero-image" className="text-sm font-medium text-foreground">
              תמונה ראשית (אופציונלי)
            </label>
            <input
              id="hero-image"
              type="file"
              accept="image/*"
              onChange={(event) => setHeroImageFile(event.target.files?.[0] ?? null)}
              className="text-sm text-foreground file:me-3 file:rounded-lg file:border-0 file:bg-primary/15 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/25"
            />
            {heroImageFile && <p className="text-xs text-muted-foreground">{heroImageFile.name}</p>}
          </div>

          <CategoryTreePicker categories={categories} selectedIds={categoryIds} onChange={setCategoryIds} />
        </fieldset>

        {result?.umbracoSyncError && (
          <div className="rounded-xl border border-error/40 bg-error/5 p-4 text-sm text-error">
            <p>{result.umbracoSyncError}</p>
            <Button type="button" variant="outline" size="sm" isLoading={isRetrying} onClick={handleRetryPublish} className="mt-3">
              נסה שוב לפרסם
            </Button>
          </div>
        )}

        {submitError && (
          <p role="alert" className="text-sm text-error">
            {submitError}
          </p>
        )}

        <Button type="submit" isLoading={isSubmitting} className="mt-2" disabled={Boolean(result) || !content}>
          יצירת האירוע
        </Button>
        {!content && !result && (
          <p className="text-sm text-muted-foreground">יש ליצור תוכן עם AI למעלה לפני שניתן ליצור את האירוע.</p>
        )}
      </form>
    </div>
  );
}
