import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  fetchMatch,
  fetchLiveGames,
  fetchHeroes,
  fetchFullPrediction,
} from '../lib/api';
import { getHeroIconUrlById, getHeroNameFromId } from '../lib/heroes';
import DotaMap from '../components/DotaMap';
import WinRateCard from '../components/WinRateCard';

function formatGameTime(sec: number): string {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.floor(Math.max(0, sec) % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatNumber(n: number | undefined | null | unknown): string {
  const num = typeof n === 'number' ? n : Number(n);
  if (num == null || isNaN(num)) return '—';
  return num.toLocaleString();
}

function formatK(n: number | undefined | null | unknown): string {
  const num = typeof n === 'number' ? n : Number(n);
  if (num == null || isNaN(num) || num === 0) return '—';
  if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}

// Player type that handles both live and parsed match data
type Player = {
  hero_id: number;
  account_id?: number;
  player_slot?: number;
  team?: number;
  team_number?: number;
  isRadiant?: boolean;
  name?: string;
  personaname?: string;
  // Parsed match fields
  net_worth?: number;
  total_gold?: number;
  gold?: number;
  gold_per_min?: number;
  total_xp?: number;
  xp_per_min?: number;
  // Live game fields
  lh?: number;  // last hits
  // Common fields
  level?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  last_hits?: number;
  denies?: number;
  life_state_dead?: number | boolean;
  is_alive?: boolean;  // Live games use this
};

type Predictions = {
  pre_match: number;
  draft: number;
  combined: number;
  live: number | null;
  final: number;
  pre_match_components?: Record<string, number | null>;
  draft_breakdown?: {
    radiant_pick_scores?: number[];
    dire_pick_scores?: number[];
    radiant_pick_breakdown?: Array<{ hero_wr: number; player_wr: number; versus_wr: number }>;
    dire_pick_breakdown?: Array<{ hero_wr: number; player_wr: number; versus_wr: number }>;
    draft_matchup_wr?: number | null;
  };
  live_components?: Record<string, number>;
};

// Helper to determine if player is on Radiant
function isRadiant(player: Player): boolean {
  if (player.isRadiant !== undefined) return player.isRadiant;
  if (player.team !== undefined) return player.team === 0;
  if (player.team_number !== undefined) return player.team_number === 0;
  if (player.player_slot !== undefined) return player.player_slot < 128;
  return true;
}

// Check if player is dead (handles both live and parsed data)
function isDead(player: Player): boolean {
  if (player.is_alive !== undefined) {
    return !player.is_alive;
  }
  return Boolean(player.life_state_dead);
}

// Get player's gold/net worth (handles both live and parsed data)
function getPlayerGold(player: Player): number | null {
  const gold = player.net_worth ?? player.total_gold ?? player.gold;
  return typeof gold === 'number' ? gold : null;
}

// Get player's XP (live games don't have XP per player)
function getPlayerXp(player: Player): number | null {
  const xp = player.total_xp;
  return typeof xp === 'number' && xp > 0 ? xp : null;
}

export default function MatchDetailPage() {
  const { matchId } = useParams();
  const [match, setMatch] = useState<Record<string, unknown> | null>(null);
  const [liveData, setLiveData] = useState<Record<string, unknown> | null>(null);
  const [heroes, setHeroes] = useState<Record<string, { name: string; localized_name?: string }>>({});
  const [predictions, setPredictions] = useState<Predictions | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState(false);
  
  // Client-side timer for live matches
  const [displayTime, setDisplayTime] = useState(0);
  const baseTimeRef = useRef(0);
  const lastFetchTimeRef = useRef(Date.now());
  const isLiveRef = useRef(false);
  const matchRef = useRef<Record<string, unknown> | null>(null);

  const loadData = useCallback(async (options?: { skipPredictions?: boolean }) => {
    if (!matchId) return;
    try {
      // Heroes are cached - fetch in parallel with match data
      const [heroData, matchOrLive] = await Promise.all([
        fetchHeroes(),
        (async () => {
          let matchData: Record<string, unknown> | null = null;
          let live: Record<string, unknown> | null = null;
          try {
            matchData = await fetchMatch(matchId);
            setIsLive(false);
            setMatch(matchData);
            setLiveData(null);
            isLiveRef.current = false;
            matchRef.current = matchData;
            return { matchData, live: null };
          } catch {
            const liveGames = await fetchLiveGames();
            live = (liveGames as Array<{ match_id: string | number }>).find(
              (g) => String(g.match_id) === matchId
            ) as Record<string, unknown> | null;
            if (live) {
              let dataToUse: Record<string, unknown> = live;
              try {
                const enriched = await fetchMatch(matchId);
                const enrichedPlayers = (enriched?.players as Player[]) || [];
                const hasStats = enrichedPlayers.some(
                  (p) => p.net_worth != null || p.kills != null || p.level != null
                );
                if (hasStats && enrichedPlayers.length >= 10) {
                  dataToUse = { ...live, players: enrichedPlayers };
                }
              } catch {
                /* use minimal live data */
              }
              setLiveData(dataToUse);
              setMatch(null);
              setIsLive(true);
              isLiveRef.current = true;
              matchRef.current = null;
              baseTimeRef.current = (live.game_time as number) || 0;
              lastFetchTimeRef.current = Date.now();
              setDisplayTime(baseTimeRef.current);
              return { matchData: null, live: dataToUse };
            }
            isLiveRef.current = false;
            matchRef.current = null;
            return { matchData: null, live: null };
          }
        })(),
      ]);

      setHeroes(heroData);

      const { matchData, live } = matchOrLive;
      const data = matchData || live;
      if (!data) return;

      const players = (data.players as Player[]) || [];
      const radPicks = players
        .filter(isRadiant)
        .map((p) => ({ hero_id: p.hero_id, account_id: p.account_id }));
      const direPicks = players
        .filter((p) => !isRadiant(p))
        .map((p) => ({ hero_id: p.hero_id, account_id: p.account_id }));

      const radTeamId = (matchData?.radiant_team_id ?? live?.team_id_radiant ?? 0) as number;
      const direTeamId = (matchData?.dire_team_id ?? live?.team_id_dire ?? 0) as number;

      const gameTime = ((matchData?.duration ?? matchData?.game_time ?? live?.game_time) as number) || 0;
      const radGoldAdv = matchData?.radiant_gold_adv as number[] | undefined;
      const radXpAdv = matchData?.radiant_xp_adv as number[] | undefined;
      const goldLead = radGoldAdv?.length ? radGoldAdv[radGoldAdv.length - 1] : (live?.radiant_lead as number) ?? 0;
      const xpLead = radXpAdv?.length ? radXpAdv[radXpAdv.length - 1] : 0;

      // Fetch predictions (skipped on lightweight refresh for finished matches)
      if (!options?.skipPredictions && (radPicks.length > 0 || direPicks.length > 0)) {
        try {
          const full = await fetchFullPrediction({
            radiant_team_id: radTeamId || 0,
            dire_team_id: direTeamId || 0,
            radiant_picks: radPicks,
            dire_picks: direPicks,
            match_id: parseInt(matchId, 10),
            game_time: gameTime,
            radiant_gold_lead: goldLead,
            radiant_xp_lead: xpLead,
            towers_destroyed: {},
          });
          setPredictions({
            pre_match: full.pre_match_probability,
            draft: full.draft_probability,
            combined: full.combined_pre_draft_probability,
            live: full.live_state_probability ?? null,
            final: full.final_win_probability,
            pre_match_components: full.pre_match_components,
            draft_breakdown: full.draft_breakdown || undefined,
            live_components: full.live_components || undefined,
          });
        } catch (e) {
          console.error('Prediction error:', e);
        }
      }

      setLastUpdate(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    loadData();
    // Poll: full refresh for live matches; lightweight (no predictions) for finished
    const t = setInterval(() => {
      if (isLiveRef.current) {
        loadData();
      } else if (matchRef.current) {
        loadData({ skipPredictions: true });
      }
    }, 15000);
    return () => clearInterval(t);
  }, [loadData]);

  // Client-side timer
  useEffect(() => {
    if (!isLive) return;
    
    const timer = setInterval(() => {
      const elapsed = (Date.now() - lastFetchTimeRef.current) / 1000;
      setDisplayTime(baseTimeRef.current + elapsed);
    }, 1000);

    return () => clearInterval(timer);
  }, [isLive]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#7cb342] border-t-transparent" />
      </div>
    );
  }

  const data = match || liveData;
  if (!data) {
    return (
      <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-12 text-center">
        <div className="mb-2 text-4xl">🔍</div>
        <div className="text-[#8b949e]">Match not found or not yet available</div>
        <Link to="/" className="mt-4 inline-block text-[#7cb342] hover:underline">
          ← Back to matches
        </Link>
      </div>
    );
  }

  const players = (data.players as Player[]) || [];
  const radiantPlayers = players.filter(isRadiant);
  const direPlayers = players.filter((p) => !isRadiant(p));

  const gameTime = isLive ? displayTime : ((data.duration ?? data.game_time ?? 0) as number);
  
  const radGoldAdv = data.radiant_gold_adv as number[] | undefined;
  const radXpAdv = data.radiant_xp_adv as number[] | undefined;
  const goldLead = radGoldAdv?.length ? radGoldAdv[radGoldAdv.length - 1] : (data.radiant_lead as number) ?? 0;
  const xpLead = radXpAdv?.length ? radXpAdv[radXpAdv.length - 1] : 0;
  const radiantScore = (data.radiant_score as number) ?? 0;
  const direScore = (data.dire_score as number) ?? 0;

  // Team names
  const radiantTeam = data.radiant_team as { name?: string } | undefined;
  const direTeam = data.dire_team as { name?: string } | undefined;
  const radiantTeamName = (radiantTeam?.name ?? data.team_name_radiant ?? 'Radiant') as string;
  const direTeamName = (direTeam?.name ?? data.team_name_dire ?? 'Dire') as string;

  // Calculate team totals
  const radiantTeamGold = radiantPlayers.reduce((s, p) => s + (getPlayerGold(p) || 0), 0);
  const direTeamGold = direPlayers.reduce((s, p) => s + (getPlayerGold(p) || 0), 0);

  // Tower status
  const towerStatusRadiant = data.tower_status_radiant as number | undefined;
  const towerStatusDire = data.tower_status_dire as number | undefined;
  const buildingState = data.building_state as number | undefined;

  // Match result
  const radiantWin = data.radiant_win as boolean | null;
  const isFinished = radiantWin !== null && radiantWin !== undefined;

  // League info
  const league = data.league as { name?: string } | undefined;
  const leagueName = (data.league_name ?? league?.name) as string | undefined;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-[#8b949e] hover:text-white">
        ← Back to matches
      </Link>

      {/* Header with team names */}
      <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-6">
        {leagueName && (
          <div className="mb-4 text-center text-sm text-[#8b949e]">{leagueName}</div>
        )}
        
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Radiant team */}
          <div className="flex-1">
            <div className={`text-2xl font-bold ${isFinished && radiantWin ? 'text-[#7cb342]' : isFinished ? 'text-white' : 'text-[#7cb342]'}`}>
              {radiantTeamName}
              {isFinished && radiantWin && <span className="ml-2 text-sm font-normal">🏆</span>}
            </div>
            <div className="mt-1 text-sm text-[#7cb342]">Radiant</div>
          </div>

          {/* Score */}
          <div className="flex items-center gap-4">
            <div className={`font-mono text-4xl font-bold ${isFinished && radiantWin ? 'text-[#7cb342]' : 'text-white'}`}>
              {radiantScore}
            </div>
            <div className="text-2xl text-[#8b949e]">:</div>
            <div className={`font-mono text-4xl font-bold ${isFinished && !radiantWin ? 'text-[#e53935]' : 'text-white'}`}>
              {direScore}
            </div>
          </div>

          {/* Dire team */}
          <div className="flex-1 text-right">
            <div className={`text-2xl font-bold ${isFinished && !radiantWin ? 'text-[#e53935]' : isFinished ? 'text-white' : 'text-[#e53935]'}`}>
              {direTeamName}
              {isFinished && !radiantWin && <span className="ml-2 text-sm font-normal">🏆</span>}
            </div>
            <div className="mt-1 text-sm text-[#e53935]">Dire</div>
          </div>
        </div>

        {/* Game status bar */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-6 border-t border-[#21262d] pt-4">
          {isLive && (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7cb342] opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7cb342]"></span>
              </span>
              <span className="text-[#7cb342] font-medium">LIVE</span>
            </div>
          )}
          {isFinished && <span className="text-[#8b949e]">Completed</span>}
          
          {gameTime > 0 && (
            <div className="text-center">
              <div className="text-2xl font-mono font-bold text-white">{formatGameTime(gameTime)}</div>
              <div className="text-xs text-[#8b949e]">{isLive ? 'Game Time' : 'Duration'}</div>
            </div>
          )}
          
          <div className="text-center">
            <div className={`text-xl font-mono font-bold ${goldLead >= 0 ? 'text-[#7cb342]' : 'text-[#e53935]'}`}>
              {goldLead >= 0 ? '+' : ''}{formatNumber(goldLead)}
            </div>
            <div className="text-xs text-[#8b949e]">Gold Lead</div>
          </div>
          
          {(xpLead !== 0 || !isLive) && (
            <div className="text-center">
              <div className={`text-xl font-mono font-bold ${xpLead >= 0 ? 'text-[#7cb342]' : 'text-[#e53935]'}`}>
                {xpLead >= 0 ? '+' : ''}{formatNumber(xpLead)}
              </div>
              <div className="text-xs text-[#8b949e]">XP Lead</div>
            </div>
          )}
        </div>
      </div>

      {/* Win Probabilities */}
      {predictions && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Win Probability Analysis</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <WinRateCard label="Pre-match" value={predictions.pre_match} subtitle="Team form + H2H" />
            <WinRateCard label="Draft" value={predictions.draft} subtitle="Hero + Player WR" />
            <WinRateCard label="Combined" value={predictions.combined} subtitle="Pre + Draft" />
            <WinRateCard label="Live State" value={predictions.live ?? predictions.combined} subtitle="Gold/XP/Towers" />
            <WinRateCard label="Final" value={predictions.final} highlight subtitle="All factors" />
          </div>

          {/* Detailed breakdown */}
          <div className="grid gap-4 rounded-xl border border-[#21262d] bg-[#161b22] p-4 md:grid-cols-3">
            {predictions.pre_match_components && (
              <div>
                <h4 className="mb-3 text-sm font-semibold text-white">Pre-match Factors</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#8b949e]">Team Rating (Elo)</span>
                    <span className="font-mono text-white">
                      {((predictions.pre_match_components.rating_probability ?? 0.5) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8b949e]">Recent Form</span>
                    <span className="font-mono text-white">
                      {((predictions.pre_match_components.form_probability ?? 0.5) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8b949e]">Head-to-Head</span>
                    <span className="font-mono text-white">
                      {((predictions.pre_match_components.h2h_probability ?? 0.5) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
            {predictions.draft_breakdown && (
              <div>
                <h4 className="mb-3 text-sm font-semibold text-white">Draft Factors</h4>
                <div className="space-y-2 text-sm">
                  <div className="text-[#8b949e] text-xs">Per hero: Patch WR + Player WR + Versus WR</div>
                  {predictions.draft_breakdown.draft_matchup_wr != null && (
                    <div className="flex justify-between">
                      <span className="text-[#8b949e]">Lineup synergy</span>
                      <span className="font-mono text-white">
                        {(predictions.draft_breakdown.draft_matchup_wr * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {predictions.live_components && (
              <div>
                <h4 className="mb-3 text-sm font-semibold text-white">Live Factors</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#8b949e]">Game State</span>
                    <span className="font-mono text-white">
                      {((predictions.live_components.game_state ?? 0.5) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8b949e]">Item Timing</span>
                    <span className="font-mono text-white">
                      ×{(predictions.live_components.item_timing_multiplier ?? 1).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Map + Players side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Map */}
        <DotaMap
          buildingState={buildingState}
          towerStatusRadiant={towerStatusRadiant}
          towerStatusDire={towerStatusDire}
        />

        {/* Players */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Radiant players */}
          <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#7cb342]">{radiantTeamName}</h3>
              {radiantTeamGold > 0 && (
                <span className="text-xs text-[#8b949e]">{formatK(radiantTeamGold)}g</span>
              )}
            </div>
            <div className="space-y-2">
              {radiantPlayers.map((p, i) => (
                <PlayerRow key={i} player={p} heroes={heroes} isLiveGame={isLive} />
              ))}
              {radiantPlayers.length === 0 && (
                <div className="text-sm text-[#8b949e]">No player data</div>
              )}
            </div>
          </div>

          {/* Dire players */}
          <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#e53935]">{direTeamName}</h3>
              {direTeamGold > 0 && (
                <span className="text-xs text-[#8b949e]">{formatK(direTeamGold)}g</span>
              )}
            </div>
            <div className="space-y-2">
              {direPlayers.map((p, i) => (
                <PlayerRow key={i} player={p} heroes={heroes} isLiveGame={isLive} />
              ))}
              {direPlayers.length === 0 && (
                <div className="text-sm text-[#8b949e]">No player data</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={loadData}
          className="rounded-lg border border-[#21262d] bg-[#161b22] px-4 py-2 text-sm text-[#8b949e] transition hover:border-[#7cb342] hover:text-white"
        >
          ↻ Refresh
        </button>
        <a
          href={`https://www.opendota.com/matches/${matchId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-[#21262d] bg-[#161b22] px-4 py-2 text-sm text-[#8b949e] transition hover:border-[#30363d] hover:text-white"
        >
          OpenDota →
        </a>
        <a
          href={`https://www.dotabuff.com/matches/${matchId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-[#21262d] bg-[#161b22] px-4 py-2 text-sm text-[#8b949e] transition hover:border-[#30363d] hover:text-white"
        >
          Dotabuff →
        </a>
        <span className="ml-auto text-xs text-[#8b949e] self-center">
          Updated: {lastUpdate.toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  heroes,
  isLiveGame,
}: {
  player: Player;
  heroes: Record<string, { name: string; localized_name?: string }>;
  isLiveGame: boolean;
}) {
  const playerIsDead = isDead(player);
  const gold = getPlayerGold(player);
  const xp = getPlayerXp(player);
  
  // Build KDA string
  const hasKda = player.kills != null || player.deaths != null || player.assists != null;
  const kda = hasKda 
    ? `${player.kills ?? 0}/${player.deaths ?? 0}/${player.assists ?? 0}` 
    : null;
  
  // CS (last hits / denies) - live games use 'lh', parsed use 'last_hits'
  const lastHits = player.last_hits ?? player.lh;
  const cs = lastHits != null ? `${lastHits}${player.denies != null ? `/${player.denies}` : ''} cs` : null;
  
  // Player name (prefer pro name over in-game nick)
  const playerName = player.name || player.personaname || 'Anonymous';

  return (
    <div className={`flex items-center gap-3 rounded-lg p-2 ${playerIsDead ? 'opacity-60' : ''} hover:bg-[#21262d] transition`}>
      <div className="relative shrink-0">
        <img
          src={getHeroIconUrlById(heroes, player.hero_id)}
          alt=""
          className={`h-10 w-10 rounded object-cover transition ${playerIsDead ? 'grayscale opacity-60' : ''}`}
        />
        {player.level != null && (
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#21262d] text-[10px] font-bold text-white border border-[#30363d]">
            {player.level}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-white">{playerName}</span>
          {playerIsDead && <span className="text-xs text-[#e53935]" title="Dead">☠</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-[#8b949e]">
          <span>{getHeroNameFromId(heroes, player.hero_id)}</span>
          {kda && <span className="font-mono">• {kda}</span>}
          {cs && <span>• {cs}</span>}
        </div>
      </div>
      <div className="text-right shrink-0 space-y-0.5">
        {gold != null && (
          <div className="font-mono text-sm font-medium text-[#ffd700]" title="Net worth">
            {gold === 0 ? '0' : formatK(gold)}g
          </div>
        )}
        {player.level != null && (
          <div className="text-xs text-[#8b949e]">Lvl {player.level}</div>
        )}
        {xp != null && (
          <div className="font-mono text-xs text-[#8b949e]">{formatK(xp)} xp</div>
        )}
        {gold == null && xp == null && !player.level && isLiveGame && (
          <div className="font-mono text-xs text-[#6e7681]">Live</div>
        )}
      </div>
    </div>
  );
}
