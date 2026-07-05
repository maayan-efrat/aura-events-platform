import { redirect } from "next/navigation";
import Link from "next/link";
import { callEventsApiAsCurrentUser, getCurrentUser } from "@/lib/backend-fetch";
import { getPublishedEventContent } from "@/lib/umbraco";
import type { EventDetail, MyRegistration } from "@/lib/types";
import { AiRecommendations } from "@/components/dashboard/AiRecommendations";
import { MyRegistrationRow } from "@/components/dashboard/MyRegistrationRow";

export const metadata = { title: "האזור האישי — AuraEvents" };

const dateFormatter = new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" });

const STATUS_LABELS: Record<EventDetail["status"], string> = {
  Draft: "טיוטה",
  Published: "פורסם",
  Cancelled: "בוטל",
  Completed: "הסתיים",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isOrganizer = user.roles.includes("Organizer") || user.roles.includes("Admin");

  const registrationsResponse = await callEventsApiAsCurrentUser("/api/users/me/registrations");
  const registrations: MyRegistration[] = registrationsResponse?.ok
    ? await registrationsResponse.json()
    : [];

  const myEventsResponse = isOrganizer ? await callEventsApiAsCurrentUser("/api/users/me/events") : null;
  const myEvents: EventDetail[] = myEventsResponse?.ok ? await myEventsResponse.json() : [];

  const eventContent = await getPublishedEventContent().catch(() => []);
  const titleByEventId = new Map(eventContent.map((item) => [item.systemEventId, item.title]));
  const slugByEventId = Object.fromEntries(eventContent.map((item) => [item.systemEventId, item.slug]));

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-foreground">
        שלום, {user.firstName} 👋
      </h1>
      <p className="mt-1 text-muted-foreground">האזור האישי שלך ב-AuraEvents</p>

      <section id="my-events" className="mt-10 scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground">האירועים שלי</h2>
        {registrations.length === 0 ? (
          <p className="mt-3 text-muted-foreground">עדיין לא נרשמת לאף אירוע.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
            {registrations.map((registration) => (
              <MyRegistrationRow
                key={registration.registrationId}
                eventId={registration.eventId}
                title={registration.eventTitle}
                initialStatus={registration.status}
              />
            ))}
          </ul>
        )}
      </section>

      {isOrganizer && (
        <section id="events-i-manage" className="mt-12 scroll-mt-20">
          <h2 className="text-xl font-semibold text-foreground">האירועים שיצרתי</h2>
          {myEvents.length === 0 ? (
            <p className="mt-3 text-muted-foreground">עדיין לא יצרת אף אירוע.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
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
        </section>
      )}

      <section id="recommendations" className="mt-12 scroll-mt-20">
        <h2 className="text-xl font-semibold text-foreground">המלצות מותאמות אישית</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          מבוסס על היסטוריית ההרשמות שלך ותחומי העניין שתשתפו.
        </p>
        <div className="mt-4">
          <AiRecommendations slugByEventId={slugByEventId} />
        </div>
      </section>
    </div>
  );
}
