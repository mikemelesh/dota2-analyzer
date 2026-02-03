import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  fetchMatch,
  fetchLiveGames,
  fetchHeroes,
  fetchFullPrediction,
} from '../lib/api';
import { getHeroIconUrlById, getHeroNameFromId } from '../lib/heroes';
import DotaMap from '../components/DotaMap';
import WinRateCard from '../components/WinRateCard';

function formatDuration(sec: number) {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, sec) % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatNumber(n: number | undefined | null | unknown): string {
  const num = typeof n === 'number' ? n : Number(n);
  if (num == null || isNaN(num)) return '—';
  return num.toLocaleString();
}

export default function MatchDetailPage() {
  const { matchId } = useParams();
  const [match, setMatch] = useState<Record<string, unknown> | null>(null);
  const [liveData, setLiveData] = useState<Record<string, unknown> | null>(null);
  const [heroes, setHeroes] = useState<Record<string, { name: string; localized_name?: string }>>({});
  const [predictions, setPredictions] = useState<{
    pre_match: number;
    draft: number;
    combined: number;
    live: number;
    final: number;
    pre_match_components?: Record<string, number | null>;
    draft_breakdown?: Record<string, unknown>;
    live_components?: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!matchId) return;
    try {
      const heroData = await fetchHeroes();
      setHeroes(heroData);

      let matchData: Record<string, unknown> | null = null;
      let live: Record<string, unknown> | null = null;

      try {
        matchData = await fetchMatch(matchId);
      } catch {
        const liveGames = await fetchLiveGames();
        live = liveGames.find((g: { match_id: string }) => String(g.match_id) === matchId) || null;
        if (live) setLiveData(live);
      }

      setMatch(matchData);

      const players = (matchData?.players as Array<{ hero_id: number; account_id?: number; team?: number; player_slot?: number }>) ||
        (live?.players as Array<{ hero_id: number; account_id?: number; team?: number; player_slot?: number }>) || [];
      const radPicks = players.filter((p) => p.team === 0 || (p.player_slot ?? 255) < 128).map((p) => ({
        hero_id: p.hero_id,
        account_id: p.account_id,
      }));
      const direPicks = players.filter((p) => p.team === 1 || (p.player_slot ?? 255) >= 128).map((p) => ({
        hero_id: p.hero_id,
        account_id: p.account_id,
      }));

      const radTeamId = (matchData?.radiant_team_id ?? live?.team_id_radiant ?? 0) as number;
      const direTeamId = (matchData?.dire_team_id ?? live?.team_id_dire ?? 0) as number;

      const gameTime = ((matchData?.duration ?? matchData?.game_time ?? live?.game_time) as number) || 0;
      const radGoldAdv = (matchData?.radiant_gold_adv as number[]);
      const radXpAdv = (matchData?.radiant_xp_adv as number[]);
      const goldLead = radGoldAdv?.length ? radGoldAdv[radGoldAdv.length - 1] : (live?.radiant_lead as number) ?? 0;
      const xpLead = radXpAdv?.length ? radXpAdv[radXpAdv.length - 1] : 0;

      if (radTeamId || direTeamId) {
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
            live: full.live_state_probability ?? full.combined_pre_draft_probability,
            final: full.final_win_probability,
            pre_match_components: full.pre_match_components,
            draft_breakdown: full.draft_breakdown,
            live_components: full.live_components,
          });
        } catch {
          setPredictions(null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 10000);
    return () => clearInterval(t);
  }, [loadData]);

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
      <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-12 text-center text-[#8b949e]">
        Match not found or not yet available
      </div>
    );
  }

  const players = (data.players as Array<Record<string, unknown>>) || [];
  const radiantPlayers = players.filter((p) => (p.team as number) === 0 || ((p.player_slot as number) ?? 0) < 128);
  const direPlayers = players.filter((p) => (p.team as number) === 1 || ((p.player_slot as number) ?? 0) >= 128);

  const gameTime = (data.duration ?? data.game_time ?? 0) as number;
  const radGoldAdv = data.radiant_gold_adv as number[] | undefined;
  const radXpAdv = data.radiant_xp_adv as number[] | undefined;
  const goldLead = radGoldAdv?.length ? radGoldAdv[radGoldAdv.length - 1] : (data.radiant_lead as number) ?? 0;
  const xpLead = radXpAdv?.length ? radXpAdv[radXpAdv.length - 1] : 0;
  const radiantScore = (data.radiant_score as number) ?? 0;
  const direScore = (data.dire_score as number) ?? 0;

  const radiantTeamGold = radiantPlayers.reduce((s, p) => s + (Number(p.net_worth) || 0), 0);
  const direTeamGold = direPlayers.reduce((s, p) => s + (Number(p.net_worth) || 0), 0);
  const radiantTeamXp = radiantPlayers.reduce((s, p) => s + (Number(p.total_xp) || 0), 0);
  const direTeamXp = direPlayers.reduce((s, p) => s + (Number(p.total_xp) || 0), 0);

  const towerStatusRadiant = data.tower_status_radiant as number | undefined;
  const towerStatusDire = data.tower_status_dire as number | undefined;
  const buildingState = data.building_state as number | undefined;
  const hasParsedTowers = towerStatusRadiant != null && towerStatusDire != null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {(data.team_name_radiant as string) || 'Radiant'} vs {(data.team_name_dire as string) || 'Dire'}
          </h1>
          <p className="mt-1 text-[#8b949e]">
            {gameTime > 0 ? `LIVE • ${formatDuration(gameTime)}` : 'Upcoming'}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="font-mono text-2xl font-bold text-[#7cb342]">{radiantScore}</div>
            <div className="text-xs text-[#8b949e]">Radiant</div>
          </div>
          <div className="h-10 w-px bg-[#21262d]" />
          <div className="text-center">
            <div className="font-mono text-2xl font-bold text-[#e53935]">{direScore}</div>
            <div className="text-xs text-[#8b949e]">Dire</div>
          </div>
          {gameTime > 0 && (
            <>
              <div className="h-10 w-px bg-[#21262d]" />
              <div className="text-center">
                <div className={`font-mono text-xl font-bold ${goldLead >= 0 ? 'text-[#7cb342]' : 'text-[#e53935]'}`}>
                  {goldLead >= 0 ? '+' : ''}{formatNumber(goldLead)}
                </div>
                <div className="text-xs text-[#8b949e]">Gold lead</div>
              </div>
              <div className="h-10 w-px bg-[#21262d]" />
              <div className="text-center">
                <div className={`font-mono text-xl font-bold ${xpLead >= 0 ? 'text-[#7cb342]' : 'text-[#e53935]'}`}>
                  {xpLead >= 0 ? '+' : ''}{formatNumber(xpLead)}
                </div>
                <div className="text-xs text-[#8b949e]">XP lead</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Team gold / XP */}
      {(radiantTeamGold > 0 || direTeamGold > 0) && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-4">
            <h4 className="mb-2 text-sm text-[#7cb342]">Radiant totals</h4>
            <div className="font-mono">Gold: {formatNumber(radiantTeamGold)} • XP: {formatNumber(radiantTeamXp)}</div>
          </div>
          <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-4">
            <h4 className="mb-2 text-sm text-[#e53935]">Dire totals</h4>
            <div className="font-mono">Gold: {formatNumber(direTeamGold)} • XP: {formatNumber(direTeamXp)}</div>
          </div>
        </div>
      )}

      {/* Win rate cards + breakdown */}
      {predictions && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <WinRateCard label="Pre-match" value={predictions.pre_match} />
            <WinRateCard label="Draft" value={predictions.draft} />
            <WinRateCard label="Combined" value={predictions.combined} />
            <WinRateCard label="Live state" value={predictions.live} />
            <WinRateCard label="Final" value={predictions.final} highlight />
          </div>
          {(predictions.pre_match_components || predictions.draft_breakdown || predictions.live_components) && (
            <div className="grid gap-4 rounded-xl border border-[#21262d] bg-[#161b22] p-4 lg:grid-cols-3">
              {predictions.pre_match_components && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-[#8b949e]">Pre-match factors</h4>
                  <div className="space-y-1 text-sm">
                    <div>Rating: {(predictions.pre_match_components.rating_probability ?? 0.5) * 100}%</div>
                    <div>Form: {(predictions.pre_match_components.form_probability ?? 0.5) * 100}%</div>
                    <div>H2H: {(predictions.pre_match_components.h2h_probability ?? 0.5) * 100}%</div>
                  </div>
                </div>
              )}
              {predictions.draft_breakdown && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-[#8b949e]">Draft factors</h4>
                  <div className="space-y-1 text-xs">
                    <div>Per pick: Hero WR + Player WR + Versus WR</div>
                    <div>Synergy: Lineup matchup history</div>
                    {predictions.draft_breakdown.draft_matchup_wr != null && (
                      <div>Lineup WR: {((predictions.draft_breakdown.draft_matchup_wr as number) * 100).toFixed(1)}%</div>
                    )}
                    {(predictions.draft_breakdown.radiant_pick_breakdown as Array<{ hero_wr: number; player_wr: number; versus_wr: number }>)?.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        <div className="text-[#7cb342]">Radiant: Hero {(predictions.draft_breakdown.radiant_pick_breakdown as Array<{ hero_wr: number }>).map((b) => (b.hero_wr * 100).toFixed(0)).join('%, ')}%</div>
                        <div className="text-[#e53935]">Dire: Hero {(predictions.draft_breakdown.dire_pick_breakdown as Array<{ hero_wr: number }>)?.map((b) => (b.hero_wr * 100).toFixed(0)).join('%, ')}%</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {predictions.live_components && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-[#8b949e]">Live factors</h4>
                  <div className="space-y-1 text-sm">
                    <div>Game state: {(predictions.live_components.game_state ?? 0.5) * 100}%</div>
                    <div>Item timing: ×{(predictions.live_components.item_timing_multiplier ?? 1).toFixed(2)}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Map + Players */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DotaMap
            buildingState={hasParsedTowers ? undefined : buildingState}
            towerStatusRadiant={towerStatusRadiant}
            towerStatusDire={towerStatusDire}
          />
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-4">
            <h3 className="mb-3 text-sm font-semibold text-[#7cb342]">Radiant</h3>
            <div className="space-y-2">
              {radiantPlayers.map((p, i) => (
                <PlayerRow key={i} player={p} heroes={heroes} isDead={Boolean(p.life_state_dead)} />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-4">
            <h3 className="mb-3 text-sm font-semibold text-[#e53935]">Dire</h3>
            <div className="space-y-2">
              {direPlayers.map((p, i) => (
                <PlayerRow key={i} player={p} heroes={heroes} isDead={Boolean(p.life_state_dead)} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Full player grid */}
      <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-4">
        <h3 className="mb-4 text-lg font-semibold text-white">Players</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm text-[#7cb342]">Radiant</h4>
            <div className="flex flex-wrap gap-2">
              {radiantPlayers.map((p, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-[#0d1117] px-3 py-2">
                  <img
                    src={getHeroIconUrlById(heroes, p.hero_id as number)}
                    alt=""
                    className={`h-10 w-10 rounded object-cover ${p.life_state_dead ? 'opacity-40 grayscale' : ''}`}
                  />
                  <div>
                    <div className="text-sm font-medium">{(p.personaname || p.name || 'Anonymous') as string}</div>
                    <div className="text-xs text-[#8b949e]">
                      {getHeroNameFromId(heroes, p.hero_id as number)} • {formatNumber(Number(p.net_worth ?? p.gold))}g • Lvl {String(p.level ?? '—')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="mb-2 text-sm text-[#e53935]">Dire</h4>
            <div className="flex flex-wrap gap-2">
              {direPlayers.map((p, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-[#0d1117] px-3 py-2">
                  <img
                    src={getHeroIconUrlById(heroes, p.hero_id as number)}
                    alt=""
                    className={`h-10 w-10 rounded object-cover ${p.life_state_dead ? 'opacity-40 grayscale' : ''}`}
                  />
                  <div>
                    <div className="text-sm font-medium">{(p.personaname || p.name || 'Anonymous') as string}</div>
                    <div className="text-xs text-[#8b949e]">
                      {getHeroNameFromId(heroes, p.hero_id as number)} • {formatNumber(Number(p.net_worth ?? p.gold))}g • Lvl {String(p.level ?? '—')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Helpful links */}
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://www.opendota.com/matches/${matchId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-[#21262d] bg-[#161b22] px-4 py-2 text-sm text-[#8b949e] hover:text-white transition"
        >
          Open on OpenDota →
        </a>
        <button
          onClick={loadData}
          className="rounded-lg border border-[#21262d] bg-[#161b22] px-4 py-2 text-sm text-[#8b949e] hover:text-white transition"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  heroes,
  isDead,
}: {
  player: Record<string, unknown>;
  heroes: Record<string, { name: string }>;
  isDead: boolean;
}) {
  const netWorth = player.net_worth ?? player.gold;
  const xp = player.total_xp ?? player.xp ?? player.level;
  return (
    <div className="flex items-center gap-3">
      <img
        src={getHeroIconUrlById(heroes, player.hero_id as number)}
        alt=""
        className={`h-8 w-8 rounded object-cover ${isDead ? 'opacity-40 grayscale' : ''}`}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{(player.personaname || player.name || '—') as string}</div>
        <div className="text-xs text-[#8b949e]">
          {formatNumber(netWorth as number)}g • {formatNumber(xp as number)} XP
        </div>
      </div>
    </div>
  );
}
