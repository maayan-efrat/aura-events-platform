import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/backend-fetch";
import { SettingsForm } from "@/components/dashboard/SettingsForm";

export const metadata = { title: "הגדרות — AuraEvents" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-foreground">הגדרות</h1>
      <p className="mt-1 text-muted-foreground">עריכת פרטי איש הקשר שלך.</p>

      <div className="mt-8">
        <SettingsForm
          email={user.email}
          initialFirstName={user.firstName}
          initialLastName={user.lastName}
          initialPhoneNumber={user.phoneNumber}
        />
      </div>
    </div>
  );
}
