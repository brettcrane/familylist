import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { SyncIndicator } from './SyncIndicator';
import { useUIStore } from '../../stores/uiStore';
import type { Theme } from '../../stores/uiStore';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  actions?: React.ReactNode;
  className?: string;
}

function ThemeToggle() {
  const theme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);

  const cycleTheme = () => {
    const themes: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setTheme(nextTheme);
  };

  const icons = {
    light: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    ),
    dark: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ),
    system: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  };

  return (
    <button
      onClick={cycleTheme}
      className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors text-[var(--color-text-secondary)]"
      aria-label={`Theme: ${theme}. Click to change.`}
      title={`Theme: ${theme}`}
    >
      {icons[theme]}
    </button>
  );
}

export function Header({
  title,
  showBack = false,
  actions,
  className,
}: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header
      className={clsx(
        'sticky top-0 z-40 safe-top',
        'bg-[var(--color-bg-primary)]/95 backdrop-blur-sm',
        'border-b border-[var(--color-text-muted)]/10',
        className
      )}
    >
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-3">
          {showBack ? (
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center w-10 h-10 -ml-2 rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors"
              aria-label="Go back"
            >
              <svg
                className="w-6 h-6 text-[var(--color-text-primary)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          ) : (
            <Link
              to="/"
              className="flex items-center justify-center w-10 h-10 -ml-2 rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors"
              aria-label="Menu"
            >
              <svg
                className="w-6 h-6 text-[var(--color-text-primary)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </Link>
          )}
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)] truncate">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-1">
          <SyncIndicator />
          <ThemeToggle />
          {actions}
        </div>
      </div>
    </header>
  );
}
