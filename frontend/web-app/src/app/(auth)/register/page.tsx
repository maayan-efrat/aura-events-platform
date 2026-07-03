import Link from "next/link";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata = { title: "הרשמה — AuraEvents" };

export default function RegisterPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8">
        <h1 className="text-2xl font-bold text-foreground">יצירת חשבון</h1>
        <p className="mt-1 text-sm text-muted-foreground">הצטרפו ל-AuraEvents בכמה שניות</p>

        <div className="mt-6">
          <RegisterForm />
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          כבר יש לך חשבון?{" "}
          <Link href="/login" className="font-semibold text-primary hover:text-primary-hover">
            התחברות
          </Link>
        </p>
      </div>
    </div>
  );
}
