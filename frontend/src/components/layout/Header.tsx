import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { SyncIndicator } from './SyncIndicator';
import { UserButton } from './UserButton';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  actions?: React.ReactNode;
  className?: string;
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
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center w-10 h-10 -ml-2 rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors"
              aria-label="Go back"
            >
              <ArrowLeftIcon className="w-6 h-6 text-[var(--color-text-primary)]" />
            </button>
          )}
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)] truncate">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-1">
          <SyncIndicator />
          {actions}
          <UserButton />
        </div>
      </div>
    </header>
  );
}
