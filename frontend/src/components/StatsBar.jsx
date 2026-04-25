'use client';

export default function StatsBar({ stats, connected, lastUpdate }) {
  const fmt = n => (n ?? 0).toLocaleString();
  const sources = stats?.sources || [];

  return (
    <div className="flex flex-wrap gap-4 items-center text-xs text-gray-400 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3">
      {/* Live indicator */}
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        <span className={connected ? 'text-green-400 font-semibold' : 'text-red-400'}>
          {connected ? 'LIVE' : 'Syncing…'}
        </span>
      </div>

      <Stat label="Total jobs" value={fmt(stats?.total)} />
      <Stat label="Last 24 h"  value={fmt(stats?.last24h)} />
      <Stat label="Last hour"  value={fmt(stats?.lastHour)} highlight />

      {/* Per-source breakdown */}
      {sources.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {sources.map(s => (
            <span key={s.source} className="bg-gray-800 px-2 py-0.5 rounded text-[10px]">
              {s.source}: <span className="text-gray-200 font-medium">{fmt(s.count)}</span>
            </span>
          ))}
        </div>
      )}

      {lastUpdate && (
        <span className="ml-auto text-gray-500">
          Updated {new Date(lastUpdate).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className={`font-bold ${highlight ? 'text-yellow-400' : 'text-gray-200'}`}>
        {value}
      </span>
      <span>{label}</span>
    </div>
  );
}
