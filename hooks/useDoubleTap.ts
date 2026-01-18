import React, { useState, useRef, useEffect } from "react";

/**
 * A hook that provides double-tap functionality for any interaction.
 * Useful for preventing accidental clicks on destructive actions.
 *
 * @param onAction The callback to execute when double-tapped
 * @param delay Time in ms to wait for the second tap (default: 2000ms)
 */
export function useDoubleTap(onAction: () => void, delay: number = 2000) {
  const [isArmed, setIsArmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInteraction = (e?: React.MouseEvent | React.PointerEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (isArmed) {
      onAction();
      setIsArmed(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    } else {
      setIsArmed(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setIsArmed(false);
      }, delay);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    isArmed,
    handleInteraction,
    arm: () => setIsArmed(true),
    disarm: () => setIsArmed(false),
  };
}
