import { useEffect, useRef } from 'react';
import { recordStudyTime } from '../utils/api';

const idleLimitMs = 30000;

function secondsBetween(start: number, end: number) {
  return Math.max(0, Math.floor((end - start) / 1000));
}

export function useStudyActivityTimer(enabled: boolean) {
  const activeStartRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const clearIdleTimer = () => {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    const flushActiveTime = (endAt = Date.now()) => {
      if (activeStartRef.current === null || lastActivityRef.current === null) return;

      const duration = secondsBetween(activeStartRef.current, endAt);
      activeStartRef.current = null;
      lastActivityRef.current = null;
      clearIdleTimer();

      if (duration > 0) {
        recordStudyTime(duration).catch((error) => {
          console.error('记录学习时间失败:', error);
        });
      }
    };

    const markActivity = () => {
      const now = Date.now();

      if (activeStartRef.current === null || lastActivityRef.current === null) {
        activeStartRef.current = now;
      } else if (now - lastActivityRef.current > idleLimitMs) {
        flushActiveTime(lastActivityRef.current);
        activeStartRef.current = now;
      }

      lastActivityRef.current = now;
      clearIdleTimer();
      idleTimerRef.current = window.setTimeout(() => flushActiveTime(), idleLimitMs);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        flushActiveTime();
      }
    };

    const handleBeforeUnload = () => {
      flushActiveTime();
    };

    window.addEventListener('keydown', markActivity);
    window.addEventListener('pointerdown', markActivity);
    window.addEventListener('click', markActivity);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', markActivity);
      window.removeEventListener('pointerdown', markActivity);
      window.removeEventListener('click', markActivity);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      flushActiveTime();
    };
  }, [enabled]);
}
