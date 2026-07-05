"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { QrScanner } from "@/components/dashboard/QrScanner";

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

/** Check-in at the door: scan a ticket's QR with the device camera, or paste/type its code manually. */
export function CheckInForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [ticketCode, setTicketCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);

  const performCheckIn = useCallback(
    async (code: string) => {
      setError(null);
      setResult(null);
      setIsSubmitting(true);

      try {
        const response = await fetch(`/api/events/${eventId}/checkin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketCode: code.trim() }),
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
    },
    [eventId, router],
  );

  async function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await performCheckIn(ticketCode);
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border p-6">
      <div className="flex gap-2">
        <Button type="button" variant={mode === "camera" ? "primary" : "outline"} size="sm" onClick={() => setMode("camera")}>
          סריקה עם מצלמה
        </Button>
        <Button type="button" variant={mode === "manual" ? "primary" : "outline"} size="sm" onClick={() => setMode("manual")}>
          הזנה ידנית
        </Button>
      </div>

      {mode === "camera" ? (
        <QrScanner onScan={performCheckIn} />
      ) : (
        <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
          <Input
            label="קוד כרטיס"
            placeholder="הדביקו/הקלידו את קוד הכרטיס"
            required
            value={ticketCode}
            onChange={(e) => setTicketCode(e.target.value)}
            dir="ltr"
          />
          <Button type="submit" isLoading={isSubmitting} className="self-start">
            ביצוע צ׳ק-אין
          </Button>
        </form>
      )}

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
    </div>
  );
}
