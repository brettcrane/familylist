import { useState } from 'react';
import { IconFolder } from '@tabler/icons-react';

interface InlineFolderInputProps {
  onConfirm: (name: string) => void;
  onCancel: () => void;
  className?: string;
  showSubmitButton?: boolean;
  autoSubmitOnBlur?: boolean;
}

export function InlineFolderInput({
  onConfirm,
  onCancel,
  className,
  showSubmitButton = false,
  autoSubmitOnBlur = false,
}: InlineFolderInputProps) {
  const [value, setValue] = useState('');

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onConfirm(trimmed);
    } else {
      onCancel();
    }
  };

  return (
    <div className={className}>
      <IconFolder className="w-4 h-4 text-[var(--color-accent)]" stroke={1.5} />
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleConfirm();
          if (e.key === 'Escape') onCancel();
        }}
        onBlur={autoSubmitOnBlur ? handleConfirm : undefined}
        placeholder="Folder name..."
        className="flex-1 min-w-0 bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none py-1"
      />
      {showSubmitButton && (
        <button
          onClick={handleConfirm}
          disabled={!value.trim()}
          className="text-sm font-medium text-[var(--color-accent)] disabled:opacity-40"
        >
          Create
        </button>
      )}
    </div>
  );
}
