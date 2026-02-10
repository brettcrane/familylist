import clsx from 'clsx';
import type { TimelineBucket } from '../../hooks/useTrackerStats';

interface TrackerChartProps {
  timeline: TimelineBucket[];
  people: { userId: string | null; userName: string; color: string }[];
}

const MAX_BAR_HEIGHT = 120;

export function TrackerChart({ timeline, people }: TrackerChartProps) {
  const maxTotal = Math.max(...timeline.map((b) => b.total), 1);

  // Only show buckets that have items or are between buckets with items
  const hasAnyData = timeline.some((b) => b.total > 0);
  if (!hasAnyData) return null;

  return (
    <div className="px-4 py-3">
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-text-muted)]/10 p-4">
        <h3 className="text-xs font-medium text-[var(--color-text-muted)] mb-3 uppercase tracking-wide">
          Timeline
        </h3>

        {/* Bars */}
        <div className="flex items-end gap-2" style={{ height: MAX_BAR_HEIGHT }}>
          {timeline.map((bucket) => {
            const barHeight = bucket.total > 0
              ? Math.max((bucket.total / maxTotal) * MAX_BAR_HEIGHT, 4)
              : 0;
            const isOverdue = bucket.label === 'Overdue';

            return (
              <div
                key={bucket.label}
                className="flex-1 flex flex-col items-center justify-end h-full"
              >
                {bucket.total > 0 && (
                  <span className="text-[10px] font-medium text-[var(--color-text-muted)] mb-1">
                    {bucket.total}
                  </span>
                )}
                <div
                  className={clsx(
                    'w-full rounded-t-md overflow-hidden flex flex-col-reverse',
                    isOverdue && bucket.total > 0 && 'ring-1 ring-red-400/30'
                  )}
                  style={{ height: barHeight }}
                >
                  {bucket.segments.map((seg, i) => {
                    const segHeight = bucket.total > 0
                      ? (seg.count / bucket.total) * 100
                      : 0;
                    return (
                      <div
                        key={seg.userId ?? `unassigned-${i}`}
                        style={{
                          height: `${segHeight}%`,
                          backgroundColor: isOverdue
                            ? blendWithRed(seg.color)
                            : seg.color,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Labels */}
        <div className="flex gap-2 mt-2">
          {timeline.map((bucket) => (
            <div key={bucket.label} className="flex-1 text-center">
              <span
                className={clsx(
                  'text-[9px] leading-tight',
                  bucket.label === 'Overdue' && bucket.total > 0
                    ? 'text-red-500 font-medium'
                    : 'text-[var(--color-text-muted)]'
                )}
              >
                {bucket.label === 'This Week' ? 'Week' : bucket.label.replace('Weeks', 'w').replace('Week', 'w')}
              </span>
            </div>
          ))}
        </div>

        {/* Legend */}
        {people.length > 1 && (
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-[var(--color-text-muted)]/10">
            {people.map((p) => (
              <div key={p.userId ?? 'unassigned'} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {p.userName}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Blend a color with red for overdue bars. */
function blendWithRed(color: string): string {
  // Simple approach: use CSS color-mix if supported, fallback to the color with reduced opacity
  return `color-mix(in srgb, ${color} 60%, #EF4444 40%)`;
}
