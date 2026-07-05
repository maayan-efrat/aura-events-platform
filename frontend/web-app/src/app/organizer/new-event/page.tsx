import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/backend-fetch";
import { NewEventForm } from "@/components/dashboard/NewEventForm";

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
        הזינו כמה נקודות גולמיות ותנו ל-AI לנסח תיאור שיווקי ומטא-דאטה ל-SEO, ואז מלאו את פרטי
        האירוע — הכל ייווצר ויתפרסם יחד, ב-Postgres וב-Umbraco.
      </p>

      <div className="mt-8">
        <NewEventForm />
      </div>
    </div>
  );
}
