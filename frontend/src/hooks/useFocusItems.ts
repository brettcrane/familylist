import { useMemo } from 'react';
import type { Item } from '../types/api';
import { getLocalDateStr, getDateOffsetStr, daysOverdue } from '../utils/dates';

const MAX_TODAY_PER_PERSON = 5;

/** A group of items belonging to one person (or unassigned). */
export interface PersonGroup {
  userId: string | null;
  userName: string;
  items: Item[];
}

/** A time-bucketed section. */
export interface FocusSection {
  id: string;
  label: string;
  personGroups: PersonGroup[];
  defaultCollapsed: boolean;
}

export interface FocusData {
  sections: FocusSection[];
  noDueDateItems: Item[];
}

/** Priority weight for sorting (higher = more important). */
const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function getPriorityWeight(item: Item): number {
  return PRIORITY_WEIGHT[item.priority ?? ''] ?? 0;
}

/** Group items by assigned_to, ordering currentUserId first, unassigned last. */
function groupByPerson(items: Item[], currentUserId: string | null): PersonGroup[] {
  const byPerson = new Map<string | null, Item[]>();

  for (const item of items) {
    const key = item.assigned_to;
    const existing = byPerson.get(key) || [];
    existing.push(item);
    byPerson.set(key, existing);
  }

  const groups: PersonGroup[] = [];
  const currentGroup = byPerson.get(currentUserId ?? '__none__');
  const unassignedGroup = byPerson.get(null);

  // Current user first
  if (currentUserId && currentGroup) {
    groups.push({
      userId: currentUserId,
      userName: currentGroup[0]?.assigned_to_name ?? 'Me',
      items: currentGroup,
    });
    byPerson.delete(currentUserId);
  }

  // Other people alphabetically
  const otherEntries = Array.from(byPerson.entries())
    .filter(([key]) => key !== null)
    .sort(([, a], [, b]) => {
      const nameA = a[0]?.assigned_to_name ?? '';
      const nameB = b[0]?.assigned_to_name ?? '';
      return nameA.localeCompare(nameB);
    });

  for (const [key, personItems] of otherEntries) {
    groups.push({
      userId: key,
      userName: personItems[0]?.assigned_to_name ?? 'Unknown',
      items: personItems,
    });
  }

  // Unassigned last
  if (unassignedGroup && !(currentUserId === null && groups.some(g => g.userId === null))) {
    // Only add if not already added as currentUser group
    if (!groups.some(g => g.userId === null)) {
      groups.push({
        userId: null,
        userName: 'Unassigned',
        items: unassignedGroup,
      });
    }
  }

  return groups;
}

/**
 * Groups unchecked items into Focus View time-bucketed sections.
 *
 * Today selection:
 * 1. All overdue items (sorted most overdue first)
 * 2. Due today
 * 3. Fill remaining slots (up to MAX_TODAY_PER_PERSON) with highest-priority urgent items due this week
 * 4. Tiebreaker: prefer magnitude === 'S' (small wins)
 */
export function useFocusItems(items: Item[], currentUserId: string | null): FocusData {
  return useMemo(() => {
    const today = getLocalDateStr();
    const weekEnd = getDateOffsetStr(7);
    const monthEnd = getDateOffsetStr(30);

    // Partition items
    const overdue: Item[] = [];
    const dueToday: Item[] = [];
    const dueThisWeek: Item[] = [];  // tomorrow through +7d
    const comingUp: Item[] = [];     // +8d through +30d
    const blocked: Item[] = [];
    const noDueDate: Item[] = [];

    for (const item of items) {
      if (item.status === 'blocked') {
        blocked.push(item);
        continue;
      }

      if (!item.due_date) {
        noDueDate.push(item);
        continue;
      }

      if (item.due_date < today) {
        overdue.push(item);
      } else if (item.due_date === today) {
        dueToday.push(item);
      } else if (item.due_date <= weekEnd) {
        dueThisWeek.push(item);
      } else if (item.due_date <= monthEnd) {
        comingUp.push(item);
      }
      // Beyond 30 days: excluded from Focus entirely
    }

    // Sort overdue by most overdue first
    overdue.sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));

    // Build Today section: overdue + due today + fill from this week
    const todayItems = [...overdue, ...dueToday];

    // Count per person in today
    const todayPersonCount = new Map<string | null, number>();
    for (const item of todayItems) {
      const key = item.assigned_to;
      todayPersonCount.set(key, (todayPersonCount.get(key) || 0) + 1);
    }

    // Sort this-week candidates by priority desc, then prefer small magnitude
    const weekCandidates = [...dueThisWeek].sort((a, b) => {
      const pDiff = getPriorityWeight(b) - getPriorityWeight(a);
      if (pDiff !== 0) return pDiff;
      // Prefer small wins
      if (a.magnitude === 'S' && b.magnitude !== 'S') return -1;
      if (b.magnitude === 'S' && a.magnitude !== 'S') return 1;
      return (a.due_date ?? '').localeCompare(b.due_date ?? '');
    });

    const promotedToToday = new Set<string>();
    for (const item of weekCandidates) {
      if (!item.priority || PRIORITY_WEIGHT[item.priority] < 4) break; // only urgent
      const personKey = item.assigned_to;
      const current = todayPersonCount.get(personKey) || 0;
      if (current < MAX_TODAY_PER_PERSON) {
        todayItems.push(item);
        promotedToToday.add(item.id);
        todayPersonCount.set(personKey, current + 1);
      }
    }

    // This Week = original dueThisWeek minus promoted items
    const thisWeekItems = dueThisWeek.filter((item) => !promotedToToday.has(item.id));

    // Sort each bucket
    thisWeekItems.sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
    comingUp.sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));

    // Build sections
    const sections: FocusSection[] = [];

    if (todayItems.length > 0) {
      sections.push({
        id: 'focus-today',
        label: 'Today',
        personGroups: groupByPerson(todayItems, currentUserId),
        defaultCollapsed: false,
      });
    }

    if (thisWeekItems.length > 0) {
      sections.push({
        id: 'focus-week',
        label: 'This Week',
        personGroups: groupByPerson(thisWeekItems, currentUserId),
        defaultCollapsed: false,
      });
    }

    if (comingUp.length > 0) {
      sections.push({
        id: 'focus-coming',
        label: 'Coming Up',
        personGroups: groupByPerson(comingUp, currentUserId),
        defaultCollapsed: true,
      });
    }

    if (blocked.length > 0) {
      sections.push({
        id: 'focus-blocked',
        label: 'Blocked',
        personGroups: [{ userId: null, userName: 'Blocked', items: blocked }],
        defaultCollapsed: true,
      });
    }

    return { sections, noDueDateItems: noDueDate };
  }, [items, currentUserId]);
}
