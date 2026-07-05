interface Attendee {
  registrationId: string;
  userId: string;
  name: string;
  email: string;
  status: "Registered" | "Waitlisted" | "Cancelled" | "CheckedIn";
  registeredAtUtc: string;
  checkedInAtUtc: string | null;
}

const STATUS_LABELS: Record<Attendee["status"], string> = {
  Registered: "רשום/ה",
  Waitlisted: "ברשימת המתנה",
  Cancelled: "בוטל",
  CheckedIn: "בוצע צ׳ק-אין",
};

const STATUS_STYLES: Record<Attendee["status"], string> = {
  Registered: "bg-surface-muted text-muted-foreground",
  Waitlisted: "bg-warning/15 text-warning",
  Cancelled: "bg-error/15 text-error",
  CheckedIn: "bg-success/15 text-success",
};

export function AttendeeList({ attendees }: { attendees: Attendee[] }) {
  if (attendees.length === 0) {
    return <p className="text-sm text-muted-foreground">עדיין אין נרשמים לאירוע זה.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-2xl border border-border">
      {attendees.map((attendee) => (
        <li key={attendee.registrationId} className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm font-medium text-foreground">{attendee.name}</p>
            {attendee.email && <p className="text-xs text-muted-foreground" dir="ltr">{attendee.email}</p>}
          </div>
          <span className={`inline-flex w-fit shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[attendee.status]}`}>
            {STATUS_LABELS[attendee.status]}
          </span>
        </li>
      ))}
    </ul>
  );
}
