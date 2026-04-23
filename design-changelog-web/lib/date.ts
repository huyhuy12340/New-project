export const TIME_ZONE = "Asia/Ho_Chi_Minh";

function parseLocalDate(date: string): Date {
  return new Date(`${date}T00:00:00+07:00`);
}

export function getCurrentDateString(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
  }).format(now);
}

export function formatDateLabel(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(parseLocalDate(date));
}

export function formatDateTimeLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

export function shiftDate(date: string, offsetDays: number): string {
  const next = parseLocalDate(date);
  next.setDate(next.getDate() + offsetDays);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
  }).format(next);
}

export function compareDatesDesc(left: string, right: string) {
  return right.localeCompare(left);
}
