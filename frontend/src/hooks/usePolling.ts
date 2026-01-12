import { useEffect, useRef } from 'react';

interface UsePollingOptions {
  callback: () => void;
  interval: number;
  enabled: boolean;
}

export const usePolling = ({ callback, interval, enabled }: UsePollingOptions) => {
  const savedCallback = useRef<() => void>();

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the polling
  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (savedCallback.current) {
        savedCallback.current();
      }
    };

    // Call immediately
    tick();

    // Then set up interval
    const id = setInterval(tick, interval);

    return () => clearInterval(id);
  }, [interval, enabled]);
};
