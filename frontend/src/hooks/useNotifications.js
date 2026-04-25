'use client';
import { useEffect, useRef, useCallback } from 'react';

export function useNotifications() {
  const audioCtxRef = useRef(null);
  const permissionRef = useRef('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      permissionRef.current = Notification.permission;
    }
  }, []);

  // Request browser notification permission
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'unsupported';
    const perm = await Notification.requestPermission();
    permissionRef.current = perm;
    return perm;
  }, []);

  // Show a browser push notification
  const notify = useCallback((title, body, url) => {
    if (permissionRef.current !== 'granted') return;
    const n = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'job-sniper',
      requireInteraction: false,
    });
    if (url) n.onclick = () => { window.open(url, '_blank'); n.close(); };
    setTimeout(() => n.close(), 8000);
  }, []);

  // Play a short beep using the Web Audio API (no external file needed)
  const playAlert = useCallback((type = 'soft') => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;

      const oscillator = ctx.createOscillator();
      const gainNode   = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      if (type === 'urgent') {
        // Two-tone urgent beep
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.12);
        oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.24);
        gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.5);
      } else {
        // Soft single ping
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(660, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.4);
      }
    } catch {}
  }, []);

  return { requestPermission, notify, playAlert };
}
