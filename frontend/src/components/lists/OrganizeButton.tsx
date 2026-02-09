import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Squares2X2Icon, CheckIcon } from '@heroicons/react/24/outline';
import { useOrganization } from '../../hooks/useOrganization';

export function OrganizeButton() {
  const { organizeMode, setOrganizeMode } = useOrganization();

  return (
    <motion.button
      onClick={() => setOrganizeMode(!organizeMode)}
      className={clsx(
        'flex items-center justify-center w-9 h-9 rounded-lg transition-colors',
        organizeMode
          ? 'bg-[var(--color-accent)] text-white'
          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]'
      )}
      whileTap={{ scale: 0.92 }}
      aria-label={organizeMode ? 'Done organizing' : 'Organize lists'}
      aria-pressed={organizeMode}
    >
      {organizeMode ? (
        <CheckIcon className="w-5 h-5" strokeWidth={2.5} />
      ) : (
        <Squares2X2Icon className="w-5 h-5" />
      )}
    </motion.button>
  );
}
