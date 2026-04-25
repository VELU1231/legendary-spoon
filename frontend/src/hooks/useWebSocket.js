'use client';
import { useEffect, useRef, useState } from 'react';
import { fetchJobs } from '@/lib/api';

const POLL_INTERVAL_MS = 30000; // 30 seconds (matches cron minimum)

/**
 * Polls /api/jobs every 30 seconds instead of using a WebSocket.
 * Maintains the same interface as the original useWebSocket hook so that
 * page.js requires no structural changes.
 *
 * - First poll seeds the seen-ID set without calling onNewJobs (avoids
 *   spurious toasts/sounds for jobs already displayed on load).
 * - Subsequent polls call onNewJobs only for genuinely new job IDs.
 * - `connected` reflects whether the most recent poll succeeded.
 */
export function useWebSocket({ onNewJobs, onConnected, onDisconnected } = {}) {
  const seenIds      = useRef(new Set());
  const firstPoll    = useRef(true);
  const connectedRef = useRef(false);
  const callbacksRef = useRef({ onNewJobs, onConnected, onDisconnected });
  const [connected, setConnected] = useState(false);

  // Keep callbacks ref fresh each render so the interval never goes stale
  useEffect(() => {
    callbacksRef.current = { onNewJobs, onConnected, onDisconnected };
  });

  useEffect(() => {
    async function poll() {
      try {
        const { jobs } = await fetchJobs({ sortBy: 'posted_at', limit: 50 });

        const newJobs = firstPoll.current
          ? []                                                          // seed pass — no toasts
          : jobs.filter(j => !seenIds.current.has(j.id));             // subsequent passes
        jobs.forEach(j => seenIds.current.add(j.id));
        firstPoll.current = false;

        if (!connectedRef.current) {
          connectedRef.current = true;
          setConnected(true);
          callbacksRef.current.onConnected?.();
        }

        if (newJobs.length > 0) {
          callbacksRef.current.onNewJobs?.(newJobs, newJobs.length);
        }
      } catch {
        if (connectedRef.current) {
          connectedRef.current = false;
          setConnected(false);
          callbacksRef.current.onDisconnected?.();
        }
      }
    }

    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentionally runs once

  return { connected };
}

