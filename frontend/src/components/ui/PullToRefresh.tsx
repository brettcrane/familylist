import { useState, useRef, useCallback, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  className?: string;
}

const PULL_THRESHOLD = 60;
const MAX_PULL = 120;

export function PullToRefresh({ children, onRefresh, className }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const container = containerRef.current;
    if (!container || isRefreshing) return;

    // Only enable pull-to-refresh when scrolled to top
    if (container.scrollTop > 0) return;

    startY.current = e.touches[0].clientY;
    isPulling.current = true;
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    if (diff > 0) {
      // Apply resistance as user pulls further
      const resistance = 1 - Math.min(diff / MAX_PULL, 1) * 0.5;
      const distance = Math.min(diff * resistance, MAX_PULL);
      setPullDistance(distance);

      // Prevent default scroll when pulling
      if (distance > 10) {
        e.preventDefault();
      }
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD);

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, isRefreshing, onRefresh]);

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      className={clsx('relative overflow-auto', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex justify-center pointer-events-none z-10"
        style={{
          top: 0,
          height: pullDistance,
          opacity: progress,
        }}
      >
        <div className="flex items-center justify-center h-full">
          <motion.div
            className={clsx(
              'w-8 h-8 rounded-full border-2 border-[var(--color-accent)]',
              isRefreshing ? 'border-t-transparent' : ''
            )}
            style={{
              scale: 0.5 + progress * 0.5,
            }}
            animate={isRefreshing ? { rotate: 360 } : { rotate: progress * 180 }}
            transition={
              isRefreshing
                ? { duration: 0.8, repeat: Infinity, ease: 'linear' }
                : { duration: 0 }
            }
          />
        </div>
      </div>

      {/* Content */}
      <motion.div
        style={{ y: pullDistance }}
        animate={{ y: pullDistance }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
