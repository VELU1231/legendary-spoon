'use client';
import { useEffect } from 'react';

export default function NotificationToast({ notifications, onDismiss }) {
  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {notifications.map(n => (
        <Toast key={n.id} notification={n} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Toast({ notification: n, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(n.id), 6000);
    return () => clearTimeout(t);
  }, [n.id, onDismiss]);

  const isUrgent = n.urgent;

  return (
    <div
      className={`
        pointer-events-auto flex items-start gap-3 p-3 rounded-xl border shadow-lg
        animate-in slide-in-from-right duration-300
        ${isUrgent
          ? 'bg-red-950 border-red-600/60 shadow-red-900/50'
          : 'bg-gray-900 border-gray-700 shadow-gray-900/50'
        }
      `}
    >
      <span className="text-lg flex-shrink-0">{isUrgent ? '🔥' : '⚡'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-100 truncate">{n.title}</p>
        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{n.body}</p>
      </div>
      <button
        onClick={() => onDismiss(n.id)}
        className="text-gray-500 hover:text-gray-300 flex-shrink-0 text-sm"
      >
        ✕
      </button>
    </div>
  );
}
