import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Squares2X2Icon, BoltIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { useUIStore, type TaskViewMode } from '../../stores/uiStore';

const VIEW_MODES: { mode: TaskViewMode; label: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
  { mode: 'categories', label: 'Categories', Icon: Squares2X2Icon },
  { mode: 'focus', label: 'Focus', Icon: BoltIcon },
  { mode: 'tracker', label: 'Tracker', Icon: ChartBarIcon },
];

export function ViewModeSwitcher() {
  const taskViewMode = useUIStore((s) => s.taskViewMode);
  const setTaskViewMode = useUIStore((s) => s.setTaskViewMode);

  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-[var(--color-bg-primary)]">
      <div className="relative flex w-full rounded-lg bg-[var(--color-bg-secondary)] p-0.5">
        {VIEW_MODES.map(({ mode, label, Icon }) => {
          const isActive = taskViewMode === mode;
          return (
            <button
              key={mode}
              onClick={() => setTaskViewMode(mode)}
              className={clsx(
                'relative flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors z-10',
                isActive
                  ? 'text-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="viewModeIndicator"
                  className="absolute inset-0 rounded-md bg-[var(--color-bg-card)] shadow-sm"
                  transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                />
              )}
              <Icon className="w-4 h-4 relative z-10" />
              <span className="relative z-10">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
