import { useMemo } from 'react';
import type { Item } from '../types/api';
import { getLocalDateStr, getDateOffsetStr, daysOverdue, getWeekBucket } from '../utils/dates';
import { getUserColor } from '../utils/colors';

export interface TrackerStats {
  overdue: number;
  dueThisWeek: number;
  dueThisMonth: number;
  undated: number;
}

export interface PersonSegment {
  userId: string | null;
  userName: string;
  count: number;
  color: string;
}

export interface TimelineBucket {
  label: string;
  total: number;
  segments: PersonSegment[];
}

export interface OverdueItem {
  item: Item;
  daysOverdue: number;
}

export interface TrackerData {
  stats: TrackerStats;
  timeline: TimelineBucket[];
  overdueItems: OverdueItem[];
  people: { userId: string | null; userName: string; color: string }[];
}

const BUCKET_ORDER = ['Overdue', 'This Week', '+1 Week', '+2 Weeks', '+3 Weeks', '+4 Weeks', 'Later'];

const UNASSIGNED_COLOR = '#94A3B8'; // slate-400

export function useTrackerStats(items: Item[]): TrackerData {
  return useMemo(() => {
    const today = getLocalDateStr();
    const weekEnd = getDateOffsetStr(7);
    const monthEnd = getDateOffsetStr(30);

    let overdue = 0;
    let dueThisWeek = 0;
    let dueThisMonth = 0;
    let undated = 0;
    const overdueItems: OverdueItem[] = [];

    // Bucket counts by person
    const bucketPeople = new Map<string, Map<string, { userId: string | null; userName: string; count: number }>>();
    for (const label of BUCKET_ORDER) {
      bucketPeople.set(label, new Map());
    }

    // Track all people seen
    const allPeople = new Map<string, { userId: string | null; userName: string }>();

    for (const item of items) {
      const personKey = item.assigned_to ?? '__unassigned__';
      const personName = item.assigned_to_name ?? 'Unassigned';

      if (!allPeople.has(personKey)) {
        allPeople.set(personKey, { userId: item.assigned_to, userName: personName });
      }

      if (!item.due_date) {
        undated++;
        continue;
      }

      // Stats
      if (item.due_date < today) {
        overdue++;
        overdueItems.push({ item, daysOverdue: daysOverdue(item.due_date) });
      }
      if (item.due_date >= today && item.due_date <= weekEnd) {
        dueThisWeek++;
      }
      if (item.due_date >= today && item.due_date <= monthEnd) {
        dueThisMonth++;
      }

      // Timeline bucket
      const bucket = getWeekBucket(item.due_date);
      const personMap = bucketPeople.get(bucket);
      if (personMap) {
        const existing = personMap.get(personKey);
        if (existing) {
          existing.count++;
        } else {
          personMap.set(personKey, { userId: item.assigned_to, userName: personName, count: 1 });
        }
      }
    }

    // Sort overdue by most overdue first
    overdueItems.sort((a, b) => b.daysOverdue - a.daysOverdue);

    // Build timeline
    const timeline: TimelineBucket[] = BUCKET_ORDER.map((label) => {
      const personMap = bucketPeople.get(label)!;
      const segments: PersonSegment[] = Array.from(personMap.values()).map((p) => ({
        userId: p.userId,
        userName: p.userName,
        count: p.count,
        color: p.userId ? getUserColor(p.userId) : UNASSIGNED_COLOR,
      }));
      const total = segments.reduce((sum, s) => sum + s.count, 0);
      return { label, total, segments };
    });

    // People legend
    const people = Array.from(allPeople.entries()).map(([key, p]) => ({
      userId: p.userId,
      userName: p.userName,
      color: key === '__unassigned__' ? UNASSIGNED_COLOR : getUserColor(p.userId!),
    }));

    return {
      stats: { overdue, dueThisWeek, dueThisMonth, undated },
      timeline,
      overdueItems,
      people,
    };
  }, [items]);
}
