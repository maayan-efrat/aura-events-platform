"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface CheckInResult {
  registrationId: string;
  status: string;
  checkedInAtUtc: string;
}

const STATUS_LABELS: Record<string, string> = {
  Registered: "רשום/ה",
  Waitlisted: "ברשימת המתנה",
  Cancelled: "בוטל",
  CheckedIn: "בוצע צ׳ק-אין",
};

/** Manual stand-in for a camera scanner: paste/type the ticket code shown under a ticket's QR. */
export function CheckInForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [ticketCode, setTicketCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/events/${eventId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketCode: ticketCode.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error?.message ?? "צ׳ק-אין נכשל.");
        return;
      }
      setResult(data as CheckInResult);
      setTicketCode("");
      router.refresh(); // re-fetches the server-rendered attendee list below
    } catch {
      setError("לא ניתן היה להתחבר לשרת. נסו שוב מאוחר יותר.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border p-6">
      <Input
        label="קוד כרטיס"
        placeholder="הדביקו/הקלידו את קוד הכרטיס"
        required
        value={ticketCode}
        onChange={(e) => setTicketCode(e.target.value)}
        dir="ltr"
      />

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      {result && (
        <p className="text-sm text-success">
          בוצע צ׳ק-אין בהצלחה — סטטוס: {STATUS_LABELS[result.status] ?? result.status}
        </p>
      )}

      <Button type="submit" isLoading={isSubmitting} className="self-start">
        ביצוע צ׳ק-אין
      </Button>
    </form>
  );
}
