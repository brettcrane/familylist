import { forwardRef, type ReactNode } from 'react';
import clsx from 'clsx';

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

export function Layout({ children, className }: LayoutProps) {
  return (
    <div
      className={clsx(
        'flex flex-col min-h-screen bg-[var(--color-bg-primary)]',
        className
      )}
    >
      {children}
    </div>
  );
}

interface MainProps {
  children: ReactNode;
  className?: string;
}

export const Main = forwardRef<HTMLElement, MainProps>(
  function Main({ children, className }, ref) {
    return (
      <main ref={ref} className={clsx('flex-1 overflow-auto', className)}>
        {children}
      </main>
    );
  }
);
