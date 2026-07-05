import { redirect } from "next/navigation";
import { callEventsApiAsCurrentUser, getCurrentUser } from "@/lib/backend-fetch";
import type { MyRegistration } from "@/lib/types";
import { MyRegistrationRow } from "@/components/dashboard/MyRegistrationRow";

export const metadata = { title: "האזור האישי — AuraEvents" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const registrationsResponse = await callEventsApiAsCurrentUser("/api/users/me/registrations");
  const registrations: MyRegistration[] = registrationsResponse?.ok
    ? await registrationsResponse.json()
    : [];

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
    </div>
  );
}
