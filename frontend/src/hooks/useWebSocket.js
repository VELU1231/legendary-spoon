'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { WS_URL } from '@/lib/api';

export function useWebSocket({ onNewJobs, onConnected, onDisconnected } = {}) {
  const wsRef      = useRef(null);
  const pingRef    = useRef(null);
  const retryRef   = useRef(null);
  const retryDelay = useRef(1000);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        retryDelay.current = 1000;
        onConnected?.();
        // Keepalive ping every 20 s
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 20000);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'new_jobs' && msg.jobs?.length) {
            onNewJobs?.(msg.jobs, msg.count);
          }
        } catch {}
      };

      ws.onclose = () => {
        setConnected(false);
        clearInterval(pingRef.current);
        onDisconnected?.();
        // Exponential back-off reconnect (max 30 s)
        retryRef.current = setTimeout(() => {
          retryDelay.current = Math.min(retryDelay.current * 1.5, 30000);
          connect();
        }, retryDelay.current);
      };

      ws.onerror = () => ws.close();
    } catch {}
  }, [onNewJobs, onConnected, onDisconnected]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(retryRef.current);
      clearInterval(pingRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected };
}
