/** Get today's date as YYYY-MM-DD in the user's local timezone. */
function getLocalDateStr(date: Date = new Date()): string {
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
