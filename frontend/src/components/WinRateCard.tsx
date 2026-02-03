export default function WinRateCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  const pct = (value * 100).toFixed(1);
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? 'border-[#7cb342] bg-[#7cb342]/10'
          : 'border-[#21262d] bg-[#161b22]'
      }`}
    >
      <div className="text-xs font-medium text-[#8b949e]">{label}</div>
      <div className="mt-1 text-2xl font-bold text-white">{pct}%</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#21262d]">
        <div
          className="h-full rounded-full bg-[#7cb342]"
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}
