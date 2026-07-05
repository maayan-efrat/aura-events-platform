import { redirect, notFound } from "next/navigation";
import { callEventsApiAsCurrentUser, getCurrentUser, getEventById } from "@/lib/backend-fetch";
import type { MyRegistration } from "@/lib/types";
import { PrintButton } from "@/components/events/PrintButton";

const dateFormatter = new Intl.DateTimeFormat("he-IL", { dateStyle: "full", timeStyle: "short" });
const priceFormatter = new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 });

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = await getEventById(eventId).catch(() => null);
  return { title: event ? `כרטיס — ${event.title}` : "כרטיס כניסה" };
}

export default async function TicketPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [event, registrationsResponse] = await Promise.all([
    getEventById(eventId).catch(() => null),
    callEventsApiAsCurrentUser("/api/users/me/registrations"),
  ]);
  if (!event) notFound();

  const registrations: MyRegistration[] = registrationsResponse?.ok ? await registrationsResponse.json() : [];
  const registration = registrations.find((r) => r.eventId === eventId);
  if (!registration || registration.status === "Cancelled") notFound();

  const qrUrl = `/api/events/${eventId}/register/qr`;

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border bg-surface-muted px-8 py-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">כרטיס כניסה — AuraEvents</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">{event.title}</h1>
        </div>

        <div className="flex flex-col items-center gap-6 px-8 py-8">
          {/* eslint-disable-next-line @next/next/no-img-element -- authenticated same-origin proxy, not a static asset */}
          <img src={qrUrl} alt="כרטיס כניסה (QR)" className="h-56 w-56" />

          <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">מתי</dt>
              <dd className="mt-1 text-foreground">{dateFormatter.format(new Date(event.startAtUtc))}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">איפה</dt>
              <dd className="mt-1 text-foreground">{event.isVirtual ? "אירוע וירטואלי" : event.venueName ?? "יפורסם בקרוב"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">מחיר</dt>
              <dd className="mt-1 text-foreground">{event.price ? priceFormatter.format(event.price) : "כניסה חופשית"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-muted-foreground">סטטוס</dt>
              <dd className="mt-1 text-foreground">{registration.status === "Waitlisted" ? "רשימת המתנה" : "מאושר"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase text-muted-foreground">קוד כרטיס (לצ׳ק-אין ידני)</dt>
              <dd className="mt-1 font-mono text-foreground" dir="ltr">
                {registration.ticketCode}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <PrintButton />
    </div>
  );
}
