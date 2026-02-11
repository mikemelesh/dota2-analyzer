const API_BASE = '/api';

async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchLiveGames() {
  return fetcher<unknown[]>(`${API_BASE}/live/games`);
}

export async function fetchProMatches(lessThanMatchId?: number) {
  const params = lessThanMatchId ? `?less_than_match_id=${lessThanMatchId}` : '';
  return fetcher<unknown[]>(`${API_BASE}/pro-matches${params}`);
}

export async function fetchMatch(matchId: string | number) {
  return fetcher<Record<string, unknown>>(`${API_BASE}/match/${matchId}`);
}

// Heroes are static - cache aggressively (24h)
const heroesCache = new Map<string, { data: unknown; timestamp: number }>();
const HEROES_CACHE_TTL = 24 * 60 * 60 * 1000;

export async function fetchHeroes() {
  const key = 'heroes';
  const cached = heroesCache.get(key);
  if (cached && Date.now() - cached.timestamp < HEROES_CACHE_TTL) {
    return cached.data as Awaited<ReturnType<typeof fetcher<Record<string, { id: number; name: string; localized_name: string }>>>>;
  }
  const result = await fetcher<Record<string, { id: number; name: string; localized_name: string }>>(`${API_BASE}/constants/heroes`);
  heroesCache.set(key, { data: result, timestamp: Date.now() });
  return result;
}

export async function fetchPrematch(radiantTeamId: number, direTeamId: number) {
  return fetcher<{
    radiant_win_probability: number;
    dire_win_probability: number;
    components?: Record<string, number>;
  }>(`${API_BASE}/prematch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ radiant_team_id: radiantTeamId, dire_team_id: direTeamId }),
  });
}

const predictionCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

// Full prediction cache - shorter TTL for live games (30s), longer for finished (5min)
const fullPredictionCache = new Map<string, { data: unknown; timestamp: number }>();
const FULL_PREDICTION_CACHE_LIVE = 30 * 1000;
const FULL_PREDICTION_CACHE_FINISHED = 5 * 60 * 1000;

export async function fetchPrematchCached(radiantTeamId: number, direTeamId: number) {
  const key = `prematch:${radiantTeamId}:${direTeamId}`;
  const cached = predictionCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as Awaited<ReturnType<typeof fetchPrematch>>;
  }
  const result = await fetchPrematch(radiantTeamId, direTeamId);
  predictionCache.set(key, { data: result, timestamp: Date.now() });
  return result;
}

type FullPredictionResponse = {
  final_win_probability: number;
  pre_match_probability: number;
  pre_match_components?: Record<string, number | null>;
  draft_probability: number;
  draft_breakdown?: unknown;
  combined_pre_draft_probability: number;
  live_state_probability?: number | null;
  live_components?: Record<string, number> | null;
};

function _fullPredictionCacheKey(params: {
  radiant_team_id: number;
  dire_team_id: number;
  radiant_picks?: unknown[];
  dire_picks?: unknown[];
  match_id?: number;
  game_time?: number;
  radiant_gold_lead?: number;
  radiant_xp_lead?: number;
}) {
  const picks = JSON.stringify([
    params.radiant_picks ?? [],
    params.dire_picks ?? [],
  ]);
  return `full:${params.match_id ?? 0}:${params.game_time ?? 0}:${params.radiant_gold_lead ?? 0}:${params.radiant_xp_lead ?? 0}:${picks}`;
}

export async function fetchFullPrediction(params: {
  radiant_team_id: number;
  dire_team_id: number;
  radiant_picks?: unknown[];
  dire_picks?: unknown[];
  match_id?: number;
  game_time?: number;
  radiant_gold_lead?: number;
  radiant_xp_lead?: number;
  towers_destroyed?: Record<string, number>;
}) {
  const isLive = (params.game_time ?? 0) > 0;
  const cacheTtl = isLive ? FULL_PREDICTION_CACHE_LIVE : FULL_PREDICTION_CACHE_FINISHED;
  const key = _fullPredictionCacheKey(params);
  const cached = fullPredictionCache.get(key);
  if (cached && Date.now() - cached.timestamp < cacheTtl) {
    return cached.data as FullPredictionResponse;
  }
  const result = await fetcher<FullPredictionResponse>(`${API_BASE}/prediction/full`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  fullPredictionCache.set(key, { data: result, timestamp: Date.now() });
  return result;
}
