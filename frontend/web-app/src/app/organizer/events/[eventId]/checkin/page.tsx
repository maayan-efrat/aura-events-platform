import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getEventById } from "@/lib/backend-fetch";
import { CheckInForm } from "@/components/dashboard/CheckInForm";

export const metadata = { title: "צ׳ק-אין — AuraEvents" };

export default async function CheckInPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.roles.includes("Organizer") && !user.roles.includes("Admin")) {
    redirect("/dashboard");
  }

  const event = await getEventById(eventId).catch(() => null);
  if (!event) notFound();

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
    </div>
  );
}
