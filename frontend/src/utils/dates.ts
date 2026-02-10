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

/** Get which week bucket a date falls into relative to today. */
export function getWeekBucket(dateStr: string): string {
  const today = getLocalDateStr();
  if (dateStr < today) return 'Overdue';

  const end1 = getDateOffsetStr(7);
  if (dateStr <= end1) return 'This Week';

  const end2 = getDateOffsetStr(14);
  if (dateStr <= end2) return '+1 Week';

  const end3 = getDateOffsetStr(21);
  if (dateStr <= end3) return '+2 Weeks';

  const end4 = getDateOffsetStr(28);
  if (dateStr <= end4) return '+3 Weeks';

  const end5 = getDateOffsetStr(35);
  if (dateStr <= end5) return '+4 Weeks';

  return 'Later';
}
