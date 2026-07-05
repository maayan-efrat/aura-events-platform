"use client";

import { useState } from "react";
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

  const isCancellable = status === "Registered" || status === "Waitlisted";

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
    <li className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-foreground">{title}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">{STATUS_LABELS[status]}</span>
        {isCancellable && (
          <Button variant="outline" size="sm" isLoading={isSubmitting} onClick={handleCancel}>
            ביטול הרשמה
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </li>
  );
}
