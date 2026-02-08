/** Colors for user avatar badges */
const AVATAR_COLORS = [
  '#4A90D9', '#D94A6B', '#5CB85C', '#F0AD4E',
  '#9B59B6', '#E67E22', '#1ABC9C', '#E74C3C',
  '#3498DB', '#2ECC71',
];

/** Get a deterministic color for a user ID */
export function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
