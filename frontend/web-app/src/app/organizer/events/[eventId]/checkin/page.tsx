import { notFound, redirect } from "next/navigation";
import { callEventsApiAsCurrentUser, getCurrentUser, getEventById } from "@/lib/backend-fetch";
import { CheckInForm } from "@/components/dashboard/CheckInForm";
import { AttendeeList } from "@/components/dashboard/AttendeeList";

export const metadata = { title: "צ׳ק-אין — AuraEvents" };

export default async function CheckInPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.roles.includes("Organizer") && !user.roles.includes("Admin")) {
    redirect("/dashboard");
  }

  const [event, attendeesResponse] = await Promise.all([
    getEventById(eventId).catch(() => null),
    callEventsApiAsCurrentUser(`/api/events/${eventId}/attendees`).catch(() => null),
  ]);
  if (!event) notFound();

  const attendees = attendeesResponse?.ok ? await attendeesResponse.json() : [];

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-foreground">{event.title}</h1>
      <p className="mt-1 text-muted-foreground">
        צ׳ק-אין בכניסה — הדביקו/הקלידו את קוד הכרטיס (מוצג מתחת ל-QR של המשתתף). זהו מענה זמני עד
        שיהיה סורק מצלמה אמיתי.
      </p>

      <div className="mt-8">
        <CheckInForm eventId={eventId} />
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">נרשמים ({attendees.length})</h2>
        <div className="mt-3">
          <AttendeeList attendees={attendees} />
        </div>
      </div>
    </div>
  );
}
