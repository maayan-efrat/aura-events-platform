import { authedFetch } from "./auth";
import { EVENTS_API_URL } from "./config";

export interface MyRegistration {
  registrationId: string;
  eventId: string;
  eventTitle: string;
  eventStartAtUtc: string;
  eventEndAtUtc: string;
  eventTimezone: string;
  status: "Registered" | "Waitlisted" | "Cancelled" | "CheckedIn";
  registeredAtUtc: string;
  ticketCode: string;
}

export async function getMyRegistrations(): Promise<MyRegistration[]> {
  const response = await authedFetch(`${EVENTS_API_URL}/api/users/me/registrations`);
  if (!response.ok) throw new Error("לא ניתן היה לטעון את האירועים שלך.");
  return response.json();
}
