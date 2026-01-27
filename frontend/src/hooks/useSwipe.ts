import { useRef, useCallback, useState } from 'react';

/** Swipe direction */
export type SwipeDirection = 'left' | 'right' | null;

/** Swipe thresholds from PRD */
const SWIPE_LEFT_THRESHOLD = 80; // Check/uncheck
const SWIPE_RIGHT_THRESHOLD = 120; // Delete
const SWIPE_RIGHT_HOLD_TIME = 200; // ms hold time for delete

/** Swipe state */
export interface SwipeState {
  offsetX: number;
  direction: SwipeDirection;
  isDragging: boolean;
  isOverThreshold: boolean;
}

/** Swipe callbacks */
export interface SwipeCallbacks {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

/**
 * Hook for handling swipe gestures on list items
 */
export function useSwipe(callbacks: SwipeCallbacks) {
  const [state, setState] = useState<SwipeState>({
    offsetX: 0,
    direction: null,
    isDragging: false,
    isOverThreshold: false,
  });

  const startX = useRef(0);
  const startY = useRef(0);
  const holdStartTime = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    holdStartTime.current = 0;
    isHorizontalSwipe.current = null;
    setState((prev) => ({ ...prev, isDragging: true }));
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!state.isDragging) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - startX.current;
    const deltaY = touch.clientY - startY.current;

    // Determine scroll direction on first significant move
    if (isHorizontalSwipe.current === null) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
    }

    // If vertical scroll, don't interfere
    if (isHorizontalSwipe.current === false) {
      setState((prev) => ({
        ...prev,
        isDragging: false,
        offsetX: 0,
        direction: null,
        isOverThreshold: false,
      }));
      return;
    }

    // Prevent vertical scroll when swiping horizontally
    if (isHorizontalSwipe.current === true) {
      e.preventDefault();
    }

    // Calculate offset with resistance at edges
    let offsetX = deltaX;
    const maxOffset = 160;

    if (Math.abs(offsetX) > maxOffset) {
      const overflow = Math.abs(offsetX) - maxOffset;
      const resistance = 1 - overflow / (overflow + 100);
      offsetX = (offsetX > 0 ? 1 : -1) * (maxOffset + overflow * resistance);
    }

    // Determine direction and threshold
    const direction: SwipeDirection = deltaX < 0 ? 'left' : deltaX > 0 ? 'right' : null;
    const threshold = direction === 'left' ? SWIPE_LEFT_THRESHOLD : SWIPE_RIGHT_THRESHOLD;
    const isOverThreshold = Math.abs(offsetX) >= threshold;

    // Track hold time for right swipe delete
    if (direction === 'right' && isOverThreshold) {
      if (holdStartTime.current === 0) {
        holdStartTime.current = Date.now();
      }
    } else {
      holdStartTime.current = 0;
    }

    setState({
      offsetX,
      direction,
      isDragging: true,
      isOverThreshold,
    });
  }, [state.isDragging]);

  const handleTouchEnd = useCallback(() => {
    const { direction, isOverThreshold, offsetX } = state;

    if (direction === 'left' && isOverThreshold) {
      callbacks.onSwipeLeft?.();
    } else if (direction === 'right' && isOverThreshold) {
      // Check if held long enough for delete
      const holdDuration = Date.now() - holdStartTime.current;
      if (holdDuration >= SWIPE_RIGHT_HOLD_TIME || Math.abs(offsetX) > SWIPE_RIGHT_THRESHOLD + 20) {
        callbacks.onSwipeRight?.();
      }
    }

    // Reset state
    setState({
      offsetX: 0,
      direction: null,
      isDragging: false,
      isOverThreshold: false,
    });
    isHorizontalSwipe.current = null;
    holdStartTime.current = 0;
  }, [state, callbacks]);

  const handleTouchCancel = useCallback(() => {
    setState({
      offsetX: 0,
      direction: null,
      isDragging: false,
      isOverThreshold: false,
    });
    isHorizontalSwipe.current = null;
    holdStartTime.current = 0;
  }, []);

  return {
    ref: elementRef,
    state,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
    },
  };
}
