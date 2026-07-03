import { notFound } from "next/navigation";
import { getEventContentBySlug } from "@/lib/umbraco";
import { getEventAvailability, getEventById, callEventsApiAsCurrentUser, getCurrentUser } from "@/lib/backend-fetch";
import type { MyRegistration } from "@/lib/types";
import { RegisterButton } from "@/components/events/RegisterButton";

const STATUS_LABELS: Record<NonNullable<Awaited<ReturnType<typeof getEventAvailability>>>["status"], string> = {
  Open: "מקומות פנויים",
  Full: "מלא — רשימת המתנה",
  Closed: "נסגר להרשמה",
};

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const content = await getEventContentBySlug(slug).catch(() => null);
  if (!content) notFound();

  const [event, availability, user] = await Promise.all([
    getEventById(content.systemEventId).catch(() => null),
    getEventAvailability(content.systemEventId).catch(() => null),
    getCurrentUser(),
  ]);

  let myRegistration: MyRegistration["status"] | null = null;
  if (user) {
    const registrationsResponse = await callEventsApiAsCurrentUser("/api/users/me/registrations");
    const registrations: MyRegistration[] = registrationsResponse?.ok ? await registrationsResponse.json() : [];
    myRegistration = registrations.find((r) => r.eventId === content.systemEventId)?.status ?? null;
  }

  const dateFormatter = new Intl.DateTimeFormat("he-IL", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: event?.timezone,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="inline-flex w-fit items-center rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
        {content.summary}
      </span>
      <h1 className="mt-4 text-4xl font-bold text-foreground">{content.title}</h1>

      {event && (
        <dl className="mt-6 grid grid-cols-1 gap-4 rounded-2xl border border-border bg-surface/70 p-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">מתי</dt>
            <dd className="mt-1 text-sm text-foreground">{dateFormatter.format(new Date(event.startAtUtc))}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">איפה</dt>
            <dd className="mt-1 text-sm text-foreground">
              {event.isVirtual ? "אירוע וירטואלי" : event.venueName ?? "יפורסם בקרוב"}
            </dd>
          </div>
        </dl>
      )}

      <p className="mt-8 whitespace-pre-line text-base leading-relaxed text-foreground">{content.description}</p>

      <div className="mt-10 rounded-2xl border border-border bg-surface/70 p-6">
        {availability && (
          <p className="mb-4 text-sm text-muted-foreground">
            {STATUS_LABELS[availability.status]} ·{" "}
            {availability.registeredCount}
            {availability.capacity ? ` / ${availability.capacity}` : ""} נרשמו
          </p>
        )}
        <RegisterButton eventId={content.systemEventId} isLoggedIn={Boolean(user)} initialStatus={myRegistration} />
      </div>
    </div>
  );
}
