"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type { MyRegistration } from "@/lib/types";

const STATUS_LABELS: Record<MyRegistration["status"], string> = {
  Registered: "את/ה רשומ/ה לאירוע",
  Waitlisted: "את/ה ברשימת ההמתנה",
  Cancelled: "ההרשמה בוטלה",
  CheckedIn: "בוצע צ׳ק-אין",
};

export function RegisterButton({
  eventId,
  isLoggedIn,
  initialStatus,
  isClosed = false,
}: {
  eventId: string;
  isLoggedIn: boolean;
  initialStatus: MyRegistration["status"] | null;
  /** Registration window closed (event cancelled/completed/already over) — an existing registration still shows its ticket. */
  isClosed?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isActive = status === "Registered" || status === "Waitlisted" || status === "CheckedIn";

  if (!isActive && isClosed) {
    return <p className="text-sm font-medium text-muted-foreground">האירוע נסגר להרשמה.</p>;
  }

  if (!isLoggedIn) {
    return (
      <Button className="w-full" onClick={() => router.push("/login")}>
        התחברות כדי להירשם
      </Button>
    );
  }
  const qrUrl = `/api/events/${eventId}/register/qr`;

  async function handleRegister() {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/events/${eventId}/register`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error?.message ?? "ההרשמה נכשלה.");
        return;
      }
      setStatus(data.status);
      router.refresh(); // re-fetches the server-rendered availability count on this page
    } catch {
      setError("לא ניתן להתחבר לשרת. נסו שוב מאוחר יותר.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancel() {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/events/${eventId}/register`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error?.message ?? "ביטול ההרשמה נכשל.");
        return;
      }
      setStatus("Cancelled");
      router.refresh();
    } catch {
      setError("לא ניתן להתחבר לשרת. נסו שוב מאוחר יותר.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {isActive ? (
        <>
          <p className="text-sm font-medium text-success">{STATUS_LABELS[status!]}</p>
          {status !== "Waitlisted" && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- authenticated same-origin proxy, not a static asset */}
              <img src={qrUrl} alt="כרטיס כניסה (QR)" className="h-40 w-40" />
              <Link href={`/tickets/${eventId}`} target="_blank" className="text-sm text-primary underline">
                צפייה בכרטיס המלא / הדפסה
              </Link>
            </div>
          )}
          <Button variant="outline" isLoading={isSubmitting} onClick={handleCancel}>
            ביטול הרשמה
          </Button>
        </>
      ) : (
        <Button isLoading={isSubmitting} onClick={handleRegister}>
          הרשמה לאירוע
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
