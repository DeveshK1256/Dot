import { useState, useRef, useEffect, useCallback } from 'react';

export function useExpandTimer({ expandTimerMs, isPinned, isEditing }) {
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const expand = useCallback(() => {
    clearTimer();
    setExpanded(true);
  }, [clearTimer]);

  const scheduleShrink = useCallback(() => {
    clearTimer();
    if (isPinned || isEditing) return; // Guard: do not shrink if user pinned or is actively typing
    timerRef.current = setTimeout(() => {
      setExpanded(false);
    }, expandTimerMs || 4000);
  }, [clearTimer, isPinned, isEditing, expandTimerMs]);

  const collapse = useCallback(() => {
    clearTimer();
    if (!isPinned) {
      setExpanded(false);
    }
  }, [clearTimer, isPinned]);

  useEffect(() => {
    if (isPinned || isEditing) {
      clearTimer();
    }
  }, [isPinned, isEditing, clearTimer]);

  return { expanded, expand, scheduleShrink, collapse, clearTimer };
}
