import { notFound, redirect } from "next/navigation";
import { getCategories, getCurrentUser, getEventById } from "@/lib/backend-fetch";
import { getPublishedEventContent } from "@/lib/umbraco";
import { EditEventForm } from "@/components/dashboard/EditEventForm";

export const metadata = { title: "עריכת אירוע — AuraEvents" };

export default async function EditEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.roles.includes("Organizer") && !user.roles.includes("Admin")) {
    redirect("/dashboard");
  }

  const [event, categories, content] = await Promise.all([
    getEventById(eventId).catch(() => null),
    getCategories().catch(() => []),
    getPublishedEventContent().catch(() => []),
  ]);
  if (!event) notFound();

  const currentHeroImageUrl = content.find((item) => item.systemEventId === eventId)?.heroImageUrl ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-foreground">{event.title}</h1>
      <p className="mt-1 text-muted-foreground">
        עריכת פרטי הלוגיסטיקה של האירוע — תאריכים, מיקום, קיבולת, מחיר, סטטוס, קטגוריות ותמונה
        ראשית. שם האירוע והתוכן השיווקי מנוהלים ב-Umbraco ואינם ניתנים לעריכה כאן.
      </p>

      <div className="mt-8">
        <EditEventForm event={event} categories={categories} currentHeroImageUrl={currentHeroImageUrl} />
      </div>
    </div>
  );
}
