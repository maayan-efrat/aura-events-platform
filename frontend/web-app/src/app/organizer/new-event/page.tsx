import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/backend-fetch";
import { EventDescriptionGenerator } from "@/components/dashboard/EventDescriptionGenerator";

export const metadata = { title: "יצירת אירוע — AuraEvents" };

export default async function NewEventPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.roles.includes("Organizer") && !user.roles.includes("Admin")) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-foreground">יצירת אירוע חדש</h1>
      <p className="mt-1 text-muted-foreground">
        הזינו כמה נקודות גולמיות ותנו ל-AI לנסח תיאור שיווקי ומטא-דאטה ל-SEO.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        (בשלב זה התוכן מועתק ידנית לעורך התוכן של Umbraco — יצירת אירוע מלאה מתוך המסך הזה
        תדרוש הוספת endpoint ייעודי ב-Events.Api.)
      </p>

      <div className="mt-8">
        <EventDescriptionGenerator />
      </div>
    </div>
  );
}
