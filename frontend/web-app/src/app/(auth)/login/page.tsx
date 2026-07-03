import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "התחברות — AuraEvents" };

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8">
        <h1 className="text-2xl font-bold text-foreground">התחברות</h1>
        <p className="mt-1 text-sm text-muted-foreground">ברוכים השבים ל-AuraEvents</p>

        <div className="mt-6">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          עדיין אין לך חשבון?{" "}
          <Link href="/register" className="font-semibold text-primary hover:text-primary-hover">
            הרשמה
          </Link>
        </p>
      </div>
    </div>
  );
}
