/** Small set of IANA zones for the event-creation form — no date library is installed in this project. */
export const SUPPORTED_TIMEZONES = [
  { value: "Asia/Jerusalem", label: "ישראל (Asia/Jerusalem)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "לונדון (Europe/London)" },
  { value: "America/New_York", label: "ניו יורק (America/New_York)" },
] as const;

export const DEFAULT_TIMEZONE = "Asia/Jerusalem";

/** Offset (minutes, east of UTC) of `timeZone` at the instant `date` represents. */
function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return (asUtc - date.getTime()) / 60_000;
}

/**
 * Converts a `<input type="datetime-local">` value (e.g. "2026-08-15T18:00", no timezone info)
 * into a UTC ISO string, treating it as wall-clock time in `timeZone`. The offset (e.g.
 * DST vs. standard time) is derived from the event's own target date, not from "now" — otherwise
 * an event created in winter for a summer date would get an hour-off offset.
 */
export function zonedTimeToUtcIso(localDateTimeValue: string, timeZone: string): string {
  const naiveUtcGuess = new Date(`${localDateTimeValue}:00Z`);
  const offsetMinutes = getTimeZoneOffsetMinutes(naiveUtcGuess, timeZone);
  const correctedMs = naiveUtcGuess.getTime() - offsetMinutes * 60_000;

  // Re-derive the offset at the corrected instant in case the first guess landed on the wrong
  // side of a DST transition.
  const refinedOffsetMinutes = getTimeZoneOffsetMinutes(new Date(correctedMs), timeZone);
  const finalMs = naiveUtcGuess.getTime() - refinedOffsetMinutes * 60_000;

  return new Date(finalMs).toISOString();
}

/**
 * Converts a UTC ISO string into a `<input type="datetime-local">` value (e.g. "2026-08-15T18:00")
 * representing the wall-clock time in `timeZone` — the inverse of zonedTimeToUtcIso, used to
 * pre-fill the edit-event form with the event's existing start/end times.
 */
export function utcIsoToZonedTimeValue(utcIso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .formatToParts(new Date(utcIso))
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
