/** Extract initials from a display name (e.g., "Brett Crane" → "BC", "Alex" → "AL"). */
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '??';
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}
