import { redirect } from "next/navigation";
import Link from "next/link";
import { callEventsApiAsCurrentUser, getCurrentUser } from "@/lib/backend-fetch";
import { getPublishedEventContent } from "@/lib/umbraco";
import type { EventDetail } from "@/lib/types";

export const metadata = { title: "האירועים שיצרתי — AuraEvents" };

const dateFormatter = new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" });

const STATUS_LABELS: Record<EventDetail["status"], string> = {
  Draft: "טיוטה",
  Published: "פורסם",
  Cancelled: "בוטל",
  Completed: "הסתיים",
};

export default async function MyEventsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.roles.includes("Organizer") && !user.roles.includes("Admin")) {
    redirect("/dashboard");
  }

  const [myEventsResponse, eventContent] = await Promise.all([
    callEventsApiAsCurrentUser("/api/users/me/events"),
    getPublishedEventContent().catch(() => []),
  ]);
  const myEvents: EventDetail[] = myEventsResponse?.ok ? await myEventsResponse.json() : [];
  const titleByEventId = new Map(eventContent.map((item) => [item.systemEventId, item.title]));

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-foreground">האירועים שיצרתי</h1>
        <Link
          href="/organizer/new-event"
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-colors hover:bg-primary-hover"
        >
          + אירוע חדש
        </Link>
      </div>
      <p className="mt-1 text-muted-foreground">ניהול האירועים שיצרת — עריכה וצ׳ק-אין בכניסה.</p>

      {myEvents.length === 0 ? (
        <p className="mt-8 text-muted-foreground">עדיין לא יצרת אף אירוע.</p>
      ) : (
        <ul className="mt-8 divide-y divide-border rounded-2xl border border-border">
          {myEvents.map((event) => (
            <li key={event.eventId} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-sm text-foreground">{titleByEventId.get(event.eventId) ?? event.title}</span>
                <p className="text-xs text-muted-foreground">
                  {dateFormatter.format(new Date(event.startAtUtc))} · {STATUS_LABELS[event.status]}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  href={`/organizer/events/${event.eventId}/checkin`}
                  className="text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
                >
                  צ׳ק-אין
                </Link>
                <Link
                  href={`/organizer/events/${event.eventId}/edit`}
                  className="text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
                >
                  עריכה
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
