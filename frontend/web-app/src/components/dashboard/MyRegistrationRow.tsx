"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type { MyRegistration } from "@/lib/types";

const STATUS_LABELS: Record<MyRegistration["status"], string> = {
  Registered: "רשום/ה",
  Waitlisted: "ברשימת המתנה",
  Cancelled: "בוטל",
  CheckedIn: "בוצע צ׳ק-אין",
};

export function MyRegistrationRow({
  eventId,
  title,
  initialStatus,
}: {
  eventId: string;
  title: string;
  initialStatus: MyRegistration["status"];
}) {
  const [status, setStatus] = useState(initialStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  const isCancellable = status === "Registered" || status === "Waitlisted";
  const hasTicket = status === "Registered" || status === "CheckedIn";
  const qrUrl = `/api/events/${eventId}/register/qr`;

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
    } catch {
      setError("לא ניתן להתחבר לשרת. נסו שוב מאוחר יותר.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 px-5 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-foreground">{title}</span>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">{STATUS_LABELS[status]}</span>
          {hasTicket && (
            <Button variant="outline" size="sm" onClick={() => setShowQr((v) => !v)}>
              {showQr ? "הסתרת הכרטיס" : "הצגת הכרטיס"}
            </Button>
          )}
          {isCancellable && (
            <Button variant="outline" size="sm" isLoading={isSubmitting} onClick={handleCancel}>
              ביטול הרשמה
            </Button>
          )}
        </div>
      </div>
      {showQr && hasTicket && (
        <div className="flex flex-col items-center gap-2 self-start rounded-lg border border-border p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- authenticated same-origin proxy, not a static asset */}
          <img src={qrUrl} alt="כרטיס כניסה (QR)" className="h-40 w-40" />
          <Link href={`/tickets/${eventId}`} target="_blank" className="text-sm text-primary underline">
            צפייה בכרטיס המלא / הדפסה
          </Link>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </li>
  );
}
