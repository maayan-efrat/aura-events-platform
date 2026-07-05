"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface SettingsFormProps {
  email: string;
  initialFirstName: string;
  initialLastName: string;
  initialPhoneNumber: string | null;
}

export function SettingsForm({ email, initialFirstName, initialLastName, initialPhoneNumber }: SettingsFormProps) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSavedAt(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phoneNumber: phoneNumber || null }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message ?? "שמירת הפרטים נכשלה.");
        return;
      }

      setSavedAt(Date.now());
    } catch {
      setError("לא ניתן להתחבר לשרת. נסו שוב מאוחר יותר.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4 rounded-2xl border border-border p-6">
      <Input label="דוא״ל" value={email} disabled dir="ltr" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="שם פרטי" required value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        <Input label="שם משפחה" required value={lastName} onChange={(event) => setLastName(event.target.value)} />
      </div>

      <Input
        label="טלפון (אופציונלי)"
        type="tel"
        dir="ltr"
        value={phoneNumber}
        onChange={(event) => setPhoneNumber(event.target.value)}
      />

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      {savedAt && (
        <p className="text-sm text-success">הפרטים נשמרו בהצלחה.</p>
      )}

      <Button type="submit" isLoading={isSaving} className="mt-2 self-start">
        שמירת שינויים
      </Button>
    </form>
  );
}
