import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchLiveGames, fetchProMatches, fetchHeroes, fetchPrematchCached, fetchFullPrediction } from '../lib/api';
import { getHeroIconUrlById } from '../lib/heroes';

type LiveGame = {
  match_id: string;
  game_time: number;
  radiant_lead: number;
  radiant_score: number;
  dire_score: number;
  team_name_radiant: string;
  team_name_dire: string;
  team_id_radiant: number;
  team_id_dire: number;
  league_id: number;
  league_name?: string;
  average_mmr: number;
  spectators: number;
  players: { hero_id: number; team: number; name?: string; account_id?: number }[];
  deactivate_time?: number;
};

type ProMatch = {
  match_id: number;
  start_time: number;
  radiant_name: string;
  dire_name: string;
  radiant_team_id: number;
  dire_team_id: number;
  league_name: string;
  radiant_score: number;
  dire_score: number;
  radiant_win: boolean | null;
  duration: number;
};

type MatchPrediction = {
  prematch: number;  // Radiant win probability
  rating: number;
  form: number;
  h2h: number | null;
};

type LivePrediction = {
  final: number;  // Radiant win probability
  pre_match?: number;
  draft?: number;
  combined?: number;
};

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatGameTime(sec: number): string {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.floor(Math.max(0, sec) % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Format win probability to show favored team's %
function formatWinProb(radiantProb: number): { pct: string; team: 'Radiant' | 'Dire'; color: string } {
  const isRadiantFavored = radiantProb >= 0.5;
  const favoredPct = isRadiantFavored ? radiantProb : 1 - radiantProb;
  return {
    pct: `${(favoredPct * 100).toFixed(0)}%`,
    team: isRadiantFavored ? 'Radiant' : 'Dire',
    color: isRadiantFavored ? 'text-[#7cb342]' : 'text-[#e53935]',
  };
}

function LiveMatchCard({ 
  game, 
  heroes,
  displayTime,
  prediction,
}: { 
  game: LiveGame; 
  heroes: Record<string, { name: string }>;
  displayTime: number;
  prediction?: LivePrediction;
}) {
  const radLead = game.radiant_lead >= 0;
  const radPlayers = game.players?.filter((p) => p.team === 0) || [];
  const direPlayers = game.players?.filter((p) => p.team === 1) || [];
  const wp = prediction ? formatWinProb(prediction.final) : null;

  return (
    <Link
      to={`/match/${game.match_id}`}
      className="block rounded-xl border border-[#21262d] bg-[#161b22] p-4 transition hover:border-[#7cb342]/50 hover:bg-[#21262d]"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7cb342] opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7cb342]"></span>
          </span>
          <span className="text-xs font-medium text-[#7cb342]">LIVE</span>
          <span className="font-mono text-xs text-[#8b949e]">{formatGameTime(displayTime)}</span>
          {game.spectators > 0 && (
            <span className="text-xs text-[#8b949e]">• {game.spectators.toLocaleString()} watching</span>
          )}
        </div>
        <span className={`font-mono text-sm font-bold ${radLead ? 'text-[#7cb342]' : 'text-[#e53935]'}`}>
          {radLead ? '+' : ''}{game.radiant_lead.toLocaleString()}g
        </span>
      </div>

      {game.league_name && (
        <div className="mb-2 text-xs text-[#8b949e]">{game.league_name}</div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-2">
          <div className="flex -space-x-1">
            {radPlayers.slice(0, 5).map((p, i) => (
              <img
                key={i}
                src={getHeroIconUrlById(heroes, p.hero_id)}
                alt=""
                className="h-8 w-8 rounded border border-[#21262d] object-cover"
              />
            ))}
          </div>
          <span className="truncate text-sm font-medium text-[#7cb342]">
            {game.team_name_radiant || 'Radiant'}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-lg bg-[#0d1117] px-3 py-1">
          <span className="font-mono font-bold text-[#7cb342]">{game.radiant_score}</span>
          <span className="text-[#8b949e]">:</span>
          <span className="font-mono font-bold text-[#e53935]">{game.dire_score}</span>
        </div>
        <div className="flex flex-1 items-center justify-end gap-2">
          <span className="truncate text-right text-sm font-medium text-[#e53935]">
            {game.team_name_dire || 'Dire'}
          </span>
          <div className="flex -space-x-1">
            {direPlayers.slice(0, 5).map((p, i) => (
              <img
                key={i}
                src={getHeroIconUrlById(heroes, p.hero_id)}
                alt=""
                className="h-8 w-8 rounded border border-[#21262d] object-cover"
              />
            ))}
          </div>
        </div>
      </div>

      {prediction && wp && (
        <div className="mt-3 pt-3 border-t border-[#21262d]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#8b949e]">Win probability:</span>
            <span className={`font-medium ${wp.color}`}>
              {wp.team} {wp.pct}
            </span>
          </div>
        </div>
      )}
    </Link>
  );
}

function ProMatchCard({ 
  match, 
  prediction,
}: { 
  match: ProMatch;
  prediction?: MatchPrediction;
}) {
  const isFinished = match.radiant_win !== null;
  const radiantWon = match.radiant_win === true;
  const durationMins = Math.floor(match.duration / 60);
  
  // Check if prediction was correct
  const predictionCorrect = prediction && isFinished
    ? (prediction.prematch >= 0.5 && radiantWon) || (prediction.prematch < 0.5 && !radiantWon)
    : null;

  const wp = prediction ? formatWinProb(prediction.prematch) : null;

  return (
    <Link
      to={`/match/${match.match_id}`}
      className="block rounded-xl border border-[#21262d] bg-[#161b22] p-4 transition hover:border-[#30363d] hover:bg-[#21262d]"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-[#8b949e]">{match.league_name || 'Pro Match'}</span>
        <div className="flex items-center gap-2 text-xs text-[#8b949e]">
          {isFinished && <span>{durationMins} min</span>}
          <span>•</span>
          <span title={formatFullDate(match.start_time)}>{formatDate(match.start_time)}</span>
        </div>
      </div>
      
      <div className="flex items-center justify-between gap-4">
        <span className={`flex-1 truncate text-sm font-medium ${isFinished && radiantWon ? 'text-[#7cb342]' : 'text-white'}`}>
          {match.radiant_name || 'Radiant'}
          {isFinished && radiantWon && <span className="ml-1 text-xs">✓</span>}
        </span>
        <div className="flex shrink-0 items-center gap-2 rounded-lg bg-[#0d1117] px-3 py-1">
          <span className={`font-mono font-bold ${isFinished && radiantWon ? 'text-[#7cb342]' : 'text-white'}`}>
            {match.radiant_score}
          </span>
          <span className="text-[#8b949e]">:</span>
          <span className={`font-mono font-bold ${isFinished && !radiantWon ? 'text-[#e53935]' : 'text-white'}`}>
            {match.dire_score}
          </span>
        </div>
        <span className={`flex-1 truncate text-right text-sm font-medium ${isFinished && !radiantWon ? 'text-[#e53935]' : 'text-white'}`}>
          {isFinished && !radiantWon && <span className="mr-1 text-xs">✓</span>}
          {match.dire_name || 'Dire'}
        </span>
      </div>

      {/* Prediction display - now shows correct percentages */}
      {prediction && wp && (
        <div className="mt-3 pt-3 border-t border-[#21262d]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#8b949e]">Pre-match prediction:</span>
            <div className="flex items-center gap-3">
              {/* Show detailed factors */}
              <span className="text-[#6e7681]" title="Team Elo rating">
                Elo: {(prediction.rating * 100).toFixed(0)}%
              </span>
              <span className="text-[#6e7681]" title="Recent form">
                Form: {(prediction.form * 100).toFixed(0)}%
              </span>
              {prediction.h2h !== null && (
                <span className="text-[#6e7681]" title="Head-to-head">
                  H2H: {(prediction.h2h * 100).toFixed(0)}%
                </span>
              )}
              {/* Main prediction */}
              <span className={`font-medium ${wp.color}`}>
                {wp.team} {wp.pct}
              </span>
              {predictionCorrect !== null && (
                <span className={predictionCorrect ? 'text-[#7cb342]' : 'text-[#e53935]'}>
                  {predictionCorrect ? '✓' : '✗'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </Link>
  );
}

export default function HomePage() {
  const [liveGames, setLiveGames] = useState<LiveGame[]>([]);
  const [proMatches, setProMatches] = useState<ProMatch[]>([]);
  const [heroes, setHeroes] = useState<Record<string, { name: string }>>({});
  const [predictions, setPredictions] = useState<Record<number, MatchPrediction>>({});
  const [livePredictions, setLivePredictions] = useState<Record<string, LivePrediction>>({});
  const [loading, setLoading] = useState(true);
  const [predictionsLoading, setPredictionsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'live' | 'recent'>('live');
  
  // Client-side timer for live games
  const [displayTimes, setDisplayTimes] = useState<Record<string, number>>({});
  const baseTimesRef = useRef<Record<string, { time: number; fetchedAt: number }>>({});
  
  // Track which predictions we've already fetched
  const fetchedPredictionsRef = useRef<Set<number>>(new Set());
  const fetchedLivePredictionsRef = useRef<Set<string>>(new Set());

  // Load main data (fast)
  const loadData = useCallback(async () => {
    try {
      const [live, pro, heroData] = await Promise.all([
        fetchLiveGames(),
        fetchProMatches(),
        fetchHeroes(),
      ]);

      const filteredLive = (live as LiveGame[]).filter((g) => 
        g.game_time >= 0 && 
        (!g.deactivate_time || g.deactivate_time === 0) &&
        (g.team_name_radiant || g.team_name_dire)
      );

      const filteredPro = (pro as ProMatch[]).filter((m) => 
        m.radiant_name && m.dire_name
      ).slice(0, 50);

      setLiveGames(filteredLive);
      setProMatches(filteredPro);
      setHeroes(heroData as Record<string, { name: string }>);
      setLastUpdate(new Date());

      // Update base times for live games
      const now = Date.now();
      const newBaseTimes: Record<string, { time: number; fetchedAt: number }> = {};
      filteredLive.forEach((g) => {
        newBaseTimes[g.match_id] = { time: g.game_time, fetchedAt: now };
      });
      baseTimesRef.current = newBaseTimes;
      
      const newDisplayTimes: Record<string, number> = {};
      filteredLive.forEach((g) => {
        newDisplayTimes[g.match_id] = g.game_time;
      });
      setDisplayTimes(newDisplayTimes);

      return { pro: filteredPro, live: filteredLive };
    } catch (e) {
      console.error(e);
      return { pro: [], live: [] };
    } finally {
      setLoading(false);
    }
  }, []);

  // Load live game predictions (full prediction with draft + live state)
  const loadLivePredictions = useCallback(async (games: LiveGame[]) => {
    const toFetch = games
      .filter(g => !fetchedLivePredictionsRef.current.has(String(g.match_id)))
      .filter(g => g.team_id_radiant && g.team_id_dire)
      .slice(0, 8);

    if (toFetch.length === 0) return;

    toFetch.forEach(g => fetchedLivePredictionsRef.current.add(String(g.match_id)));

    const results = await Promise.allSettled(
      toFetch.map(async (g) => {
        const radPicks = (g.players || []).filter(p => p.team === 0).map(p => ({ hero_id: p.hero_id, account_id: p.account_id || 0 }));
        const direPicks = (g.players || []).filter(p => p.team === 1).map(p => ({ hero_id: p.hero_id, account_id: p.account_id || 0 }));

        const res = await fetchFullPrediction({
          radiant_team_id: g.team_id_radiant,
          dire_team_id: g.team_id_dire,
          radiant_picks: radPicks,
          dire_picks: direPicks,
          match_id: parseInt(String(g.match_id), 10),
          game_time: g.game_time,
          radiant_gold_lead: g.radiant_lead ?? 0,
          radiant_xp_lead: 0,
          towers_destroyed: {},
        });
        return {
          matchId: String(g.match_id),
          final: res.final_win_probability,
          pre_match: res.pre_match_probability,
          draft: res.draft_probability,
          combined: res.combined_pre_draft_probability,
        };
      })
    );

    const newPreds: Record<string, LivePrediction> = {};
    results.forEach((r) => {
      if (r.status === 'fulfilled') {
        newPreds[r.value.matchId] = {
          final: r.value.final,
          pre_match: r.value.pre_match,
          draft: r.value.draft,
          combined: r.value.combined,
        };
      }
    });
    if (Object.keys(newPreds).length > 0) {
      setLivePredictions(prev => ({ ...prev, ...newPreds }));
    }
  }, []);

  // Load predictions for recent matches
  const loadPredictions = useCallback(async (matches: ProMatch[]) => {
    const matchesToPredict = matches
      .filter(m => !fetchedPredictionsRef.current.has(m.match_id))
      .filter(m => m.radiant_team_id && m.dire_team_id)
      .slice(0, 15); // Limit to 15 for performance

    if (matchesToPredict.length === 0) return;

    setPredictionsLoading(true);
    
    // Mark all as being fetched
    matchesToPredict.forEach(m => fetchedPredictionsRef.current.add(m.match_id));

    // Fetch all predictions in parallel with concurrency limit
    const batchSize = 5;
    for (let i = 0; i < matchesToPredict.length; i += batchSize) {
      const batch = matchesToPredict.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (m) => {
          const res = await fetchPrematchCached(m.radiant_team_id, m.dire_team_id);
          return { 
            matchId: m.match_id, 
            prematch: res.radiant_win_probability,
            rating: res.components?.rating_probability ?? 0.5,
            form: res.components?.form_probability ?? 0.5,
            h2h: res.components?.h2h_probability ?? null,
          };
        })
      );

      // Update predictions as they come in
      const newPredictions: Record<number, MatchPrediction> = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          newPredictions[result.value.matchId] = {
            prematch: result.value.prematch,
            rating: result.value.rating,
            form: result.value.form,
            h2h: result.value.h2h,
          };
        }
      });

      if (Object.keys(newPredictions).length > 0) {
        setPredictions(prev => ({ ...prev, ...newPredictions }));
      }
    }

    setPredictionsLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    loadData().then(({ pro, live }) => {
      if (pro.length > 0) loadPredictions(pro);
      if (live.length > 0) loadLivePredictions(live);
    });
  }, [loadData, loadPredictions, loadLivePredictions]);

  // Periodic refresh
  useEffect(() => {
    const t = setInterval(() => {
      loadData().then(({ live }) => {
        if (live.length > 0) loadLivePredictions(live);
      });
    }, 15000);
    return () => clearInterval(t);
  }, [loadData, loadLivePredictions]);

  // Client-side timer
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const newDisplayTimes: Record<string, number> = {};
      Object.entries(baseTimesRef.current).forEach(([id, { time, fetchedAt }]) => {
        const elapsed = (now - fetchedAt) / 1000;
        newDisplayTimes[id] = time + elapsed;
      });
      setDisplayTimes(newDisplayTimes);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Calculate prediction accuracy
  const predictionStats = useMemo(() => {
    return proMatches.reduce(
      (acc, m) => {
        const pred = predictions[m.match_id];
        if (!pred || m.radiant_win === null) return acc;
        const correct = (pred.prematch >= 0.5 && m.radiant_win) || (pred.prematch < 0.5 && !m.radiant_win);
        return {
          total: acc.total + 1,
          correct: acc.correct + (correct ? 1 : 0),
        };
      },
      { total: 0, correct: 0 }
    );
  }, [proMatches, predictions]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#7cb342] border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dota 2 Matches</h1>
          <p className="mt-1 text-sm text-[#8b949e]">
            Last updated: {lastUpdate.toLocaleTimeString()}
            {predictionStats.total > 0 && (
              <span className="ml-3">
                Accuracy: {predictionStats.correct}/{predictionStats.total} ({((predictionStats.correct / predictionStats.total) * 100).toFixed(0)}%)
              </span>
            )}
            {predictionsLoading && (
              <span className="ml-3 text-[#7cb342]">Loading predictions...</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              loadData().then(({ pro, live }) => {
                fetchedPredictionsRef.current.clear();
                fetchedLivePredictionsRef.current.clear();
                setPredictions({});
                setLivePredictions({});
                if (pro.length > 0) loadPredictions(pro);
                if (live.length > 0) loadLivePredictions(live);
              });
            }}
            className="rounded-lg border border-[#21262d] bg-[#161b22] px-3 py-2 text-sm text-[#8b949e] transition hover:border-[#7cb342] hover:text-white"
          >
            ↻ Refresh
          </button>
          <div className="flex rounded-lg bg-[#161b22] p-1">
            <button
              onClick={() => setActiveTab('live')}
              className={`rounded px-4 py-2 text-sm font-medium transition ${
                activeTab === 'live' ? 'bg-[#7cb342] text-black' : 'text-[#8b949e] hover:text-white'
              }`}
            >
              Live ({liveGames.length})
            </button>
            <button
              onClick={() => setActiveTab('recent')}
              className={`rounded px-4 py-2 text-sm font-medium transition ${
                activeTab === 'recent' ? 'bg-[#7cb342] text-black' : 'text-[#8b949e] hover:text-white'
              }`}
            >
              Recent ({proMatches.length})
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {activeTab === 'live' && (
          <>
            {liveGames.length > 0 ? (
              liveGames.map((game) => (
                <LiveMatchCard 
                  key={game.match_id} 
                  game={game} 
                  heroes={heroes}
                  displayTime={displayTimes[game.match_id] ?? game.game_time}
                  prediction={livePredictions[game.match_id]}
                />
              ))
            ) : (
              <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-12 text-center">
                <div className="mb-2 text-4xl">🎮</div>
                <div className="text-[#8b949e]">No live pro matches at the moment</div>
                <div className="mt-2 text-xs text-[#8b949e]">Check back later or view recent matches</div>
              </div>
            )}
          </>
        )}

        {activeTab === 'recent' && (
          <>
            {proMatches.length > 0 ? (
              proMatches.map((match) => (
                <ProMatchCard 
                  key={match.match_id} 
                  match={match}
                  prediction={predictions[match.match_id]}
                />
              ))
            ) : (
              <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-12 text-center text-[#8b949e]">
                No recent pro matches found
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
