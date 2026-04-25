'use client';

/** Three-bar visual breakdown of win probability dimensions */
export default function WinScoreMeter({ score, breakdown = {} }) {
  const { competition = 0, urgency = 0, simplicity = 0 } = breakdown;

  const color = score >= 80 ? '#22c55e'   // green
              : score >= 60 ? '#eab308'   // yellow
              : score >= 40 ? '#f97316'   // orange
              :               '#ef4444';  // red

  return (
    <div className="space-y-1.5">
      {/* Composite score */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold" style={{ color }}>
          WIN PROB
        </span>
        <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${score}%`, backgroundColor: color }}
          />
        </div>
        <span className="text-xs font-bold tabular-nums" style={{ color }}>
          {score}%
        </span>
      </div>

      {/* Dimension bars */}
      <div className="grid grid-cols-3 gap-1">
        <DimBar label="Competition" value={competition} />
        <DimBar label="Urgency"     value={urgency}     />
        <DimBar label="Simplicity"  value={simplicity}  />
      </div>
    </div>
  );
}

function DimBar({ label, value }) {
  const dimColor = value >= 70 ? '#4ade80' : value >= 45 ? '#facc15' : '#f87171';
  return (
    <div>
      <div className="text-[9px] text-gray-400 mb-0.5 truncate">{label}</div>
      <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${value}%`, backgroundColor: dimColor }}
        />
      </div>
      <div className="text-[9px] tabular-nums mt-0.5" style={{ color: dimColor }}>
        {value}
      </div>
    </div>
  );
}
