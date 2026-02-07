import { ApiError } from '../../api/client';
import { Button } from './Button';

interface ErrorStateProps {
  title: string;
  error: unknown;
  onRetry: () => void;
}

function formatError(error: unknown): string {
  if (error instanceof ApiError) {
    return `Server returned ${error.status}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Please check your connection and try again';
}

export function ErrorState({ title, error, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="text-5xl mb-4">😕</div>
      <h2 className="font-semibold text-[var(--color-text-primary)]">
        {title}
      </h2>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        {formatError(error)}
      </p>
      <Button onClick={onRetry} size="sm" className="mt-4">
        Try again
      </Button>
    </div>
  );
}
