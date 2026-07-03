import { redirect } from "next/navigation";
import { callEventsApiAsCurrentUser, getCurrentUser } from "@/lib/backend-fetch";
import { getPublishedEventContent } from "@/lib/umbraco";
import type { MyRegistration } from "@/lib/types";
import { AiRecommendations } from "@/components/dashboard/AiRecommendations";

const STATUS_LABELS: Record<MyRegistration["status"], string> = {
  Registered: "רשום/ה",
  Waitlisted: "ברשימת המתנה",
  Cancelled: "בוטל",
  CheckedIn: "בוצע צ׳ק-אין",
};

export const metadata = { title: "האזור האישי — AuraEvents" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const registrationsResponse = await callEventsApiAsCurrentUser("/api/users/me/registrations");
  const registrations: MyRegistration[] = registrationsResponse?.ok
    ? await registrationsResponse.json()
    : [];

  const eventContent = await getPublishedEventContent().catch(() => []);
  const titleByEventId = new Map(eventContent.map((item) => [item.systemEventId, item.title]));

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-foreground">
        שלום, {user.firstName} 👋
      </h1>
      <p className="mt-1 text-muted-foreground">האזור האישי שלך ב-AuraEvents</p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">האירועים שלי</h2>
        {registrations.length === 0 ? (
          <p className="mt-3 text-muted-foreground">עדיין לא נרשמת לאף אירוע.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
            {registrations.map((registration) => (
              <li
                key={registration.registrationId}
                className="flex items-center justify-between px-5 py-4"
              >
                <span className="text-sm text-foreground">
                  {titleByEventId.get(registration.eventId) ?? registration.eventId}
                </span>
                <span className="text-sm font-medium text-muted-foreground">
                  {STATUS_LABELS[registration.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-foreground">המלצות מותאמות אישית</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          מבוסס על היסטוריית ההרשמות שלך ותחומי העניין שתשתפו.
        </p>
        <div className="mt-4">
          <AiRecommendations />
        </div>
      </section>
    </div>
  );
}
