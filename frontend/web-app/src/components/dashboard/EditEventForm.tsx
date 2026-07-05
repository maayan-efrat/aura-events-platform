"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CategoryTreePicker } from "@/components/dashboard/CategoryTreePicker";
import { fileToBase64 } from "@/lib/files";
import { SUPPORTED_TIMEZONES, utcIsoToZonedTimeValue, zonedTimeToUtcIso } from "@/lib/timezone";
import type { Category, EventDetail, UpdateEventPayload } from "@/lib/types";

const selectClassName =
  "h-11 rounded-xl border border-border bg-surface px-4 text-sm text-foreground focus-visible:border-primary";

export function EditEventForm({
  event,
  categories,
  currentHeroImageUrl,
}: {
  event: EventDetail;
  categories: Category[];
  currentHeroImageUrl: string | null;
}) {
  const router = useRouter();

  const [startLocal, setStartLocal] = useState(utcIsoToZonedTimeValue(event.startAtUtc, event.timezone));
  const [endLocal, setEndLocal] = useState(utcIsoToZonedTimeValue(event.endAtUtc, event.timezone));
  const [timezone, setTimezone] = useState(event.timezone);
  const [venueName, setVenueName] = useState(event.venueName ?? "");
  const [isVirtual, setIsVirtual] = useState(event.isVirtual);
  const [capacity, setCapacity] = useState(event.capacity?.toString() ?? "");
  const [price, setPrice] = useState(event.price?.toString() ?? "");
  const [status, setStatus] = useState<EventDetail["status"]>(event.status);
  const [categoryIds, setCategoryIds] = useState<string[]>(event.categories.map((c) => c.categoryId));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [heroImagePreviewUrl, setHeroImagePreviewUrl] = useState(currentHeroImageUrl);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageSaved, setImageSaved] = useState(false);

  async function handleSaveImage() {
    if (!heroImageFile) return;
    setImageError(null);
    setImageSaved(false);
    setIsSavingImage(true);

    try {
      const response = await fetch(`/api/events/${event.eventId}/hero-image`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroImageBase64: await fileToBase64(heroImageFile),
          heroImageFileName: heroImageFile.name,
          heroImageContentType: heroImageFile.type || "application/octet-stream",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setImageError(data.error?.message ?? "עדכון התמונה נכשל.");
        return;
      }
      setImageSaved(true);
      router.refresh();
    } catch {
      setImageError("לא ניתן היה להתחבר לשרת. נסו שוב מאוחר יותר.");
    } finally {
      setIsSavingImage(false);
    }
  }

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setError(null);
    setSaved(false);
    setIsSubmitting(true);

    const payload: UpdateEventPayload = {
      startAtUtc: zonedTimeToUtcIso(startLocal, timezone),
      endAtUtc: zonedTimeToUtcIso(endLocal, timezone),
      timezone,
      venueName: isVirtual ? null : venueName || null,
      isVirtual,
      capacity: capacity ? Number(capacity) : null,
      price: price ? Number(price) : null,
      status,
      categoryIds,
    };

    try {
      const response = await fetch(`/api/events/${event.eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message ?? "עדכון האירוע נכשל.");
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError("לא ניתן להתחבר לשרת. נסו שוב מאוחר יותר.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="תאריך ושעת התחלה"
          type="datetime-local"
          required
          value={startLocal}
          onChange={(e) => setStartLocal(e.target.value)}
        />
        <Input
          label="תאריך ושעת סיום"
          type="datetime-local"
          required
          value={endLocal}
          onChange={(e) => setEndLocal(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-timezone" className="text-sm font-medium text-foreground">
          אזור זמן
        </label>
        <select id="edit-timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} className={selectClassName}>
          {SUPPORTED_TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={isVirtual} onChange={(e) => setIsVirtual(e.target.checked)} />
        אירוע וירטואלי
      </label>

      {!isVirtual && <Input label="מקום האירוע" value={venueName} onChange={(e) => setVenueName(e.target.value)} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="קיבולת (אופציונלי)"
          type="number"
          min={1}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
        />
        <Input
          label="מחיר בש״ח (ריק = כניסה חופשית)"
          type="number"
          min={0}
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-status" className="text-sm font-medium text-foreground">
          סטטוס
        </label>
        <select
          id="edit-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as EventDetail["status"])}
          className={selectClassName}
        >
          <option value="Draft">טיוטה</option>
          <option value="Published">פורסם</option>
          <option value="Cancelled">בוטל</option>
          <option value="Completed">הסתיים</option>
        </select>
      </div>

      <CategoryTreePicker categories={categories} selectedIds={categoryIds} onChange={setCategoryIds} />

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      {saved && <p className="text-sm text-success">השינויים נשמרו בהצלחה.</p>}

      <Button type="submit" isLoading={isSubmitting} className="mt-2">
        שמירת שינויים
      </Button>
    </form>

    <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-border p-6">
      <div>
        <h2 className="text-sm font-semibold text-foreground">תמונה ראשית</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          התמונה מוצגת בעמוד האירוע וברשימת האירועים. שינוי כאן מפרסם מחדש את תוכן האירוע ב-Umbraco.
        </p>
      </div>

      {heroImagePreviewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- external Umbraco media URL, not a static asset
        <img src={heroImagePreviewUrl} alt="תמונה ראשית נוכחית" className="h-40 w-full rounded-xl object-cover" />
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-hero-image" className="text-sm font-medium text-foreground">
          החלפת תמונה
        </label>
        <input
          id="edit-hero-image"
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            setHeroImageFile(file);
            setImageSaved(false);
            if (file) setHeroImagePreviewUrl(URL.createObjectURL(file));
          }}
          className="text-sm text-foreground file:me-3 file:rounded-lg file:border-0 file:bg-primary/15 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/25"
        />
      </div>

      {imageError && (
        <p role="alert" className="text-sm text-error">
          {imageError}
        </p>
      )}
      {imageSaved && <p className="text-sm text-success">התמונה עודכנה בהצלחה.</p>}

      <Button
        type="button"
        variant="outline"
        isLoading={isSavingImage}
        disabled={!heroImageFile}
        onClick={handleSaveImage}
        className="self-start"
      >
        שמירת תמונה
      </Button>
    </div>
    </>
  );
}
