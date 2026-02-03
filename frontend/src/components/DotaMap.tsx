/**
 * Simplified Dota 2 map with tower status.
 * Radiant bottom-left, Dire top-right.
 */
import { parseBuildingState, parseMatchTowers } from '../lib/towerState';

export default function DotaMap({
  buildingState,
  towerStatusRadiant,
  towerStatusDire,
}: {
  buildingState?: number;
  towerStatusRadiant?: number;
  towerStatusDire?: number;
}) {
  const { radiant, dire } =
    towerStatusRadiant != null && towerStatusDire != null
      ? parseMatchTowers(towerStatusRadiant, towerStatusDire)
      : buildingState != null
        ? parseBuildingState(buildingState)
        : { radiant: [] as number[], dire: [] as number[] };

  // Tower positions (simplified diamond map)
  const radPos = [
    [15, 85], [50, 70], [85, 15],  // Bot T1, Mid T1, Top T1
    [25, 75], [50, 50], [75, 25],  // Bot T2, Mid T2, Top T2
    [35, 65], [50, 35], [65, 35],  // Bot T3, Mid T3, Top T3
    [42, 58], [50, 50],            // Rax, Ancient
  ];
  const direPos = [
    [85, 15], [50, 30], [15, 85],  // Top T1, Mid T1, Bot T1
    [75, 25], [50, 50], [25, 75],  // Top T2, Mid T2, Bot T2
    [65, 35], [50, 65], [35, 65],  // Top T3, Mid T3, Bot T3
    [58, 42], [50, 50],            // Rax, Ancient
  ];

  const Tower = ({ x, y, standing, team }: { x: number; y: number; standing: number; team: 'radiant' | 'dire' }) => (
    <g>
      <circle
        cx={x}
        cy={y}
        r={4}
        fill={standing === 1 ? (team === 'radiant' ? '#7cb342' : '#e53935') : '#333'}
        stroke={standing === 1 ? '#fff' : '#555'}
        strokeWidth={1}
      />
    </g>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-[#21262d] bg-[#0d1117]">
      <div className="border-b border-[#21262d] px-4 py-2">
        <h3 className="text-sm font-semibold text-white">Map — Tower Status</h3>
      </div>
      <div className="p-4">
        <svg viewBox="0 0 100 100" className="w-full max-w-md">
          {/* Map background gradient */}
          <defs>
            <linearGradient id="mapBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1a472a" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#4a1a1a" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          <rect width="100" height="100" fill="url(#mapBg)" />
          {/* Rivers / lanes */}
          <path d="M0 50 Q50 50 100 50" stroke="#2d5a87" strokeWidth="2" fill="none" opacity="0.5" />
          <path d="M50 0 Q50 50 50 100" stroke="#2d5a87" strokeWidth="2" fill="none" opacity="0.5" />
          {/* Radiant base */}
          <circle cx="10" cy="90" r="8" fill="#7cb342" opacity="0.3" />
          {/* Dire base */}
          <circle cx="90" cy="10" r="8" fill="#e53935" opacity="0.3" />
          {/* Radiant towers */}
          {radiant.slice(0, 11).map((s, i) => (
            <Tower key={`r-${i}`} x={radPos[i]?.[0] ?? 0} y={radPos[i]?.[1] ?? 0} standing={s} team="radiant" />
          ))}
          {/* Dire towers */}
          {dire.slice(0, 11).map((s, i) => (
            <Tower key={`d-${i}`} x={direPos[i]?.[0] ?? 0} y={direPos[i]?.[1] ?? 0} standing={s} team="dire" />
          ))}
        </svg>
        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#7cb342]" />
            <span className="text-[#8b949e]">Radiant standing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#e53935]" />
            <span className="text-[#8b949e]">Dire standing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#333]" />
            <span className="text-[#8b949e]">Destroyed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
