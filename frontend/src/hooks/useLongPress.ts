import { useCallback, useRef } from 'react';

interface UseLongPressOptions {
  onLongPress: (e: React.MouseEvent | React.TouchEvent) => void;
  onClick?: (e: React.MouseEvent | React.TouchEvent) => void;
  threshold?: number;
}

interface UseLongPressReturn {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}

export function useLongPress({
  onLongPress,
  onClick,
  threshold = 500,
}: UseLongPressOptions): UseLongPressReturn {
  const timerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const start = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      longPressTriggeredRef.current = false;

      // Store start position for movement detection
      if ('touches' in e) {
        startPosRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      } else {
        startPosRef.current = {
          x: e.clientX,
          y: e.clientY,
        };
      }

      timerRef.current = window.setTimeout(() => {
        longPressTriggeredRef.current = true;
        onLongPress(e);

        // Haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate(10);
        }
      }, threshold);
    },
    [onLongPress, threshold]
  );

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // If long press was triggered, prevent the click
      if (longPressTriggeredRef.current) {
        e.preventDefault();
        e.stopPropagation();
        longPressTriggeredRef.current = false;
        return;
      }

      // Otherwise, call onClick if provided
      onClick?.(e);
    },
    [onClick]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      start(e);
    },
    [start]
  );

  const handleMouseUp = useCallback(() => {
    clear();
  }, [clear]);

  const handleMouseLeave = useCallback(() => {
    clear();
  }, [clear]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      start(e);
    },
    [start]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      clear();

      // If long press was triggered, prevent any click events
      if (longPressTriggeredRef.current) {
        e.preventDefault();
      }
    },
    [clear]
  );

  return {
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseLeave,
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onClick: handleClick,
  };
}
