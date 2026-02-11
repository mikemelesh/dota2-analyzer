export default function WinRateCard({
  label,
  value,
  highlight,
  subtitle,
}: {
  label: string;
  value: number;  // Radiant win probability (0-1)
  highlight?: boolean;
  subtitle?: string;
}) {
  const isRadiantFavored = value >= 0.5;
  
  // Show the favored team's probability
  // If Radiant favored (value >= 0.5): show value
  // If Dire favored (value < 0.5): show (1 - value) = Dire's probability
  const favoredPct = isRadiantFavored ? value * 100 : (1 - value) * 100;
  const displayPct = favoredPct.toFixed(1);
  
  const barColor = isRadiantFavored ? '#7cb342' : '#e53935';
  const favoredTeam = isRadiantFavored ? 'Radiant' : 'Dire';

  return (
    <div
      className={`rounded-xl border p-4 transition ${
        highlight
          ? 'border-[#7cb342] bg-[#7cb342]/10 ring-1 ring-[#7cb342]/50'
          : 'border-[#21262d] bg-[#161b22] hover:border-[#30363d]'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#8b949e]">{label}</span>
        {highlight && <span className="text-xs text-[#7cb342]">★</span>}
      </div>
      <div className={`mt-1 font-mono text-2xl font-bold ${isRadiantFavored ? 'text-[#7cb342]' : 'text-[#e53935]'}`}>
        {displayPct}%
      </div>
      <div className="mt-1 text-[10px] text-[#8b949e]">
        {favoredTeam} favored
      </div>
      {subtitle && (
        <div className="mt-1 text-[9px] text-[#6e7681]">{subtitle}</div>
      )}
      {/* Progress bar: Radiant fills from left, Dire from right */}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#21262d] relative">
        {isRadiantFavored ? (
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${value * 100}%`, backgroundColor: barColor }}
          />
        ) : (
          <div
            className="h-full rounded-full transition-all duration-500 ml-auto"
            style={{ width: `${(1 - value) * 100}%`, backgroundColor: barColor }}
          />
        )}
      </div>
    </div>
  );
}
