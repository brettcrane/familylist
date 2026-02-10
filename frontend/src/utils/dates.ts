/** Get today's date as YYYY-MM-DD in the user's local timezone. */
export function getLocalDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Check if a YYYY-MM-DD date string is before today (local timezone). */
export function isOverdue(dateStr: string): boolean {
  return dateStr < getLocalDateStr();
}

/** Format a YYYY-MM-DD date string for display. */
export function formatDueDate(dateStr: string): string {
  const today = getLocalDateStr();
  if (dateStr === today) return 'Today';

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === getLocalDateStr(tomorrow)) return 'Tomorrow';

  if (dateStr < today) return 'Overdue';

  const [, month, day] = dateStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month) - 1]} ${parseInt(day)}`;
}

/** How many days overdue a date is. Returns 0 if not overdue. */
export function daysOverdue(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

/** Get a YYYY-MM-DD string N days from today. */
export function getDateOffsetStr(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return getLocalDateStr(date);
}

/** Check if a YYYY-MM-DD string falls within [start, end] inclusive. */
export function isDateInRange(dateStr: string, start: string, end: string): boolean {
  return dateStr >= start && dateStr <= end;
}

export interface WeekBucketBoundaries {
  today: string;
  week1: string;
  week2: string;
  week3: string;
  week4: string;
  week5: string;
}

/** Pre-compute week bucket boundaries once (call outside loops). */
export function computeWeekBuckets(): WeekBucketBoundaries {
  return {
    today: getLocalDateStr(),
    week1: getDateOffsetStr(7),
    week2: getDateOffsetStr(14),
    week3: getDateOffsetStr(21),
    week4: getDateOffsetStr(28),
    week5: getDateOffsetStr(35),
  };
}

/** Get which week bucket a date falls into, using pre-computed boundaries. */
export function getWeekBucket(dateStr: string, b: WeekBucketBoundaries): string {
  if (dateStr < b.today) return 'Overdue';
  if (dateStr <= b.week1) return 'This Week';
  if (dateStr <= b.week2) return '+1 Week';
  if (dateStr <= b.week3) return '+2 Weeks';
  if (dateStr <= b.week4) return '+3 Weeks';
  if (dateStr <= b.week5) return '+4 Weeks';
  return 'Later';
}
