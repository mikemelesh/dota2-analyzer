/**
 * Dota 2 minimap with tower status overlay.
 * Tower positions are based on actual Dota 2 map layout.
 * Radiant base: bottom-left, Dire base: top-right
 */
import { parseBuildingState, parseMatchTowers } from '../lib/towerState';

// Using an SVG-based map for reliability
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
        : { radiant: Array(11).fill(1) as number[], dire: Array(11).fill(1) as number[] };

  // Tower positions calibrated for SVG viewBox (0-100)
  // Bit order: Top T1, Top T2, Top T3, Mid T1, Mid T2, Mid T3, Bot T1, Bot T2, Bot T3, Ancient T4, Ancient T4
  // Radiant towers (green) - positioned along Radiant side of lanes
  const radTowers = [
    { x: 8,  y: 35, label: 'Top T1' },      // Top lane T1 (far left)
    { x: 8,  y: 52, label: 'Top T2' },      // Top lane T2
    { x: 8,  y: 68, label: 'Top T3' },      // Top lane T3 (near base)
    { x: 35, y: 58, label: 'Mid T1' },      // Mid T1
    { x: 25, y: 68, label: 'Mid T2' },      // Mid T2
    { x: 18, y: 76, label: 'Mid T3' },      // Mid T3
    { x: 68, y: 92, label: 'Bot T1' },      // Bot lane T1 (far right)
    { x: 48, y: 92, label: 'Bot T2' },      // Bot lane T2
    { x: 28, y: 92, label: 'Bot T3' },      // Bot lane T3 (near base)
    { x: 12, y: 82, label: 'Ancient' },     // Ancient T4 top
    { x: 18, y: 88, label: 'Ancient' },     // Ancient T4 bot
  ];

  // Dire towers (red) - positioned along Dire side of lanes
  const direTowers = [
    { x: 32, y: 8,  label: 'Top T1' },      // Top lane T1 (far left for dire)
    { x: 52, y: 8,  label: 'Top T2' },      // Top lane T2
    { x: 72, y: 8,  label: 'Top T3' },      // Top lane T3 (near base)
    { x: 65, y: 42, label: 'Mid T1' },      // Mid T1
    { x: 75, y: 32, label: 'Mid T2' },      // Mid T2
    { x: 82, y: 24, label: 'Mid T3' },      // Mid T3
    { x: 92, y: 65, label: 'Bot T1' },      // Bot lane T1 (far right)
    { x: 92, y: 48, label: 'Bot T2' },      // Bot lane T2
    { x: 92, y: 32, label: 'Bot T3' },      // Bot lane T3 (near base)
    { x: 82, y: 12, label: 'Ancient' },     // Ancient T4 top
    { x: 88, y: 18, label: 'Ancient' },     // Ancient T4 bot
  ];

  const radiantStanding = radiant.filter((s: number) => s === 1).length;
  const direStanding = dire.filter((s: number) => s === 1).length;

  return (
    <div className="overflow-hidden rounded-xl border border-[#21262d] bg-[#0d1117]">
      <div className="flex items-center justify-between border-b border-[#21262d] px-4 py-2">
        <h3 className="text-sm font-semibold text-white">Tower Status</h3>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-[#7cb342]">Radiant: {radiantStanding}/11</span>
          <span className="text-[#e53935]">Dire: {direStanding}/11</span>
        </div>
      </div>
      <div className="p-4">
        <svg viewBox="0 0 100 100" className="mx-auto w-full max-w-sm">
          {/* Map background gradient */}
          <defs>
            <linearGradient id="mapBg" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1a3a1a" />
              <stop offset="50%" stopColor="#1a1a1a" />
              <stop offset="100%" stopColor="#3a1a1a" />
            </linearGradient>
          </defs>
          
          {/* Background */}
          <rect width="100" height="100" fill="url(#mapBg)" rx="4" />
          
          {/* Lanes */}
          {/* Top lane: goes left then up */}
          <path d="M8 92 L8 8 L92 8" stroke="#333" strokeWidth="4" fill="none" opacity="0.6" />
          {/* Bot lane: goes down then right */}
          <path d="M8 92 L92 92 L92 8" stroke="#333" strokeWidth="4" fill="none" opacity="0.6" />
          {/* Mid lane: diagonal */}
          <path d="M8 92 L92 8" stroke="#333" strokeWidth="4" fill="none" opacity="0.6" />
          
          {/* River (diagonal across mid) */}
          <path d="M0 55 Q25 50 50 50 Q75 50 100 45" stroke="#2a5a7a" strokeWidth="6" fill="none" opacity="0.4" />
          
          {/* Radiant base */}
          <rect x="2" y="78" width="22" height="20" rx="3" fill="#7cb342" opacity="0.2" />
          <text x="13" y="90" fontSize="5" fill="#7cb342" textAnchor="middle" fontWeight="bold">RAD</text>
          
          {/* Dire base */}
          <rect x="76" y="2" width="22" height="20" rx="3" fill="#e53935" opacity="0.2" />
          <text x="87" y="14" fontSize="5" fill="#e53935" textAnchor="middle" fontWeight="bold">DIRE</text>
          
          {/* Roshan pit */}
          <circle cx="72" cy="38" r="5" fill="#ffa500" opacity="0.25" />
          <text x="72" y="40" fontSize="4" fill="#ffa500" textAnchor="middle" opacity="0.8">RS</text>
          
          {/* Radiant towers */}
          {radTowers.map((t, i) => {
            const isStanding = radiant[i] === 1;
            return (
              <g key={`rad-${i}`}>
                <title>Radiant {t.label} - {isStanding ? 'Standing' : 'Destroyed'}</title>
                {isStanding && (
                  <circle cx={t.x} cy={t.y} r={4.5} fill="#7cb342" opacity={0.3} />
                )}
                <circle
                  cx={t.x}
                  cy={t.y}
                  r={isStanding ? 3 : 2}
                  fill={isStanding ? '#7cb342' : '#333'}
                  stroke={isStanding ? '#fff' : '#555'}
                  strokeWidth={isStanding ? 1 : 0.5}
                  opacity={isStanding ? 1 : 0.5}
                />
              </g>
            );
          })}
          
          {/* Dire towers */}
          {direTowers.map((t, i) => {
            const isStanding = dire[i] === 1;
            return (
              <g key={`dire-${i}`}>
                <title>Dire {t.label} - {isStanding ? 'Standing' : 'Destroyed'}</title>
                {isStanding && (
                  <circle cx={t.x} cy={t.y} r={4.5} fill="#e53935" opacity={0.3} />
                )}
                <circle
                  cx={t.x}
                  cy={t.y}
                  r={isStanding ? 3 : 2}
                  fill={isStanding ? '#e53935' : '#333'}
                  stroke={isStanding ? '#fff' : '#555'}
                  strokeWidth={isStanding ? 1 : 0.5}
                  opacity={isStanding ? 1 : 0.5}
                />
              </g>
            );
          })}
        </svg>
        
        {/* Legend */}
        <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[#7cb342] shadow-[0_0_6px_#7cb342]" />
            <span className="text-[#8b949e]">Radiant</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[#e53935] shadow-[0_0_6px_#e53935]" />
            <span className="text-[#8b949e]">Dire</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#333] border border-[#555]" />
            <span className="text-[#8b949e]">Destroyed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
