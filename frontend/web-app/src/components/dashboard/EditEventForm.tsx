"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CategoryTreePicker } from "@/components/dashboard/CategoryTreePicker";
import { SUPPORTED_TIMEZONES, utcIsoToZonedTimeValue, zonedTimeToUtcIso } from "@/lib/timezone";
import type { Category, EventDetail, UpdateEventPayload } from "@/lib/types";

const selectClassName =
  "h-11 rounded-xl border border-border bg-surface px-4 text-sm text-foreground focus-visible:border-primary";

export function EditEventForm({ event, categories }: { event: EventDetail; categories: Category[] }) {
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
  );
}
