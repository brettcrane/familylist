import { createContext, useContext, type ReactNode } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

/** Tabs context */
interface TabsContextValue {
  value: string;
  onChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider');
  }
  return context;
}

/** Tabs root component */
interface TabsProps {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ value, onChange, children, className }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

/** Tab list component */
interface TabListProps {
  children: ReactNode;
  className?: string;
}

export function TabList({ children, className }: TabListProps) {
  return (
    <div
      className={clsx(
        'flex border-b border-[var(--color-text-muted)]/20',
        className
      )}
      role="tablist"
    >
      {children}
    </div>
  );
}

/** Tab trigger component */
interface TabTriggerProps {
  value: string;
  children: ReactNode;
  count?: number;
  className?: string;
}

export function TabTrigger({
  value,
  children,
  count,
  className,
}: TabTriggerProps) {
  const { value: activeValue, onChange } = useTabsContext();
  const isActive = value === activeValue;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => onChange(value)}
      className={clsx(
        'relative flex-1 px-4 py-3 font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)]',
        isActive
          ? 'text-[var(--color-text-primary)]'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
        className
      )}
    >
      <span className="flex items-center justify-center gap-2">
        {children}
        {typeof count === 'number' && (
          <span
            className={clsx(
              'text-sm',
              isActive
                ? 'text-[var(--color-text-secondary)]'
                : 'text-[var(--color-text-muted)]'
            )}
          >
            ({count})
          </span>
        )}
      </span>
      {isActive && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-accent)]"
          layoutId="tab-indicator"
          transition={{ duration: 0.15 }}
        />
      )}
    </button>
  );
}

/** Tab content component */
interface TabContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabContent({ value, children, className }: TabContentProps) {
  const { value: activeValue } = useTabsContext();

  if (value !== activeValue) return null;

  return (
    <motion.div
      role="tabpanel"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
