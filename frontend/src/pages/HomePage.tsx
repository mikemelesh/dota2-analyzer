import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchLiveGames, fetchProMatches, fetchHeroes } from '../lib/api';
import { getHeroIconUrlById } from '../lib/heroes';

type LiveGame = {
  match_id: string;
  game_time: number;
  radiant_lead: number;
  radiant_score: number;
  dire_score: number;
  team_name_radiant: string;
  team_name_dire: string;
  league_id: number;
  average_mmr: number;
  players: { hero_id: number; team: number; name?: string }[];
};

type ProMatch = {
  match_id: number;
  start_time: number;
  radiant_name: string;
  dire_name: string;
  league_name: string;
  radiant_score: number;
  dire_score: number;
  radiant_win: boolean | null;
  duration: number;
};

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function MatchCard({ game, heroes }: { game: LiveGame; heroes: Record<string, { name: string }> }) {
  const radLead = game.radiant_lead >= 0;
  const radPlayers = game.players?.filter((p) => p.team === 0) || [];
  const direPlayers = game.players?.filter((p) => p.team === 1) || [];

  return (
    <Link
      to={`/match/${game.match_id}`}
      className="block rounded-xl border border-[#21262d] bg-[#161b22] p-4 transition hover:border-[#7cb342]/50 hover:bg-[#21262d]"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-[#8b949e]">LIVE • {formatDuration(game.game_time)}</span>
        <span className={`font-mono text-sm font-bold ${radLead ? 'text-[#7cb342]' : 'text-[#e53935]'}`}>
          {radLead ? '+' : ''}{game.radiant_lead.toLocaleString()} gold
        </span>
      </div>
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
          <span className="truncate text-sm font-medium">
            {game.team_name_radiant || 'Radiant'}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 px-3">
          <span className="font-bold text-[#7cb342]">{game.radiant_score}</span>
          <span className="text-[#8b949e]">–</span>
          <span className="font-bold text-[#e53935]">{game.dire_score}</span>
        </div>
        <div className="flex flex-1 items-center justify-end gap-2">
          <span className="truncate text-right text-sm font-medium">
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
    </Link>
  );
}

function ProMatchCard({ match }: { match: ProMatch }) {
  const isLive = match.radiant_win === null;
  return (
    <Link
      to={`/match/${match.match_id}`}
      className="block rounded-xl border border-[#21262d] bg-[#161b22] p-4 transition hover:border-[#30363d] hover:bg-[#21262d]"
    >
      <div className="mb-2 text-xs text-[#8b949e]">{match.league_name}</div>
      <div className="flex items-center justify-between gap-4">
        <span className="truncate text-sm font-medium">{match.radiant_name || 'Radiant'}</span>
        <div className="flex shrink-0 items-center gap-2 px-3">
          <span className={`font-bold ${!isLive && match.radiant_win ? 'text-[#7cb342]' : 'text-white'}`}>
            {match.radiant_score}
          </span>
          <span className="text-[#8b949e]">–</span>
          <span className={`font-bold ${!isLive && !match.radiant_win ? 'text-[#e53935]' : 'text-white'}`}>
            {match.dire_score}
          </span>
        </div>
        <span className="truncate text-right text-sm font-medium">{match.dire_name || 'Dire'}</span>
      </div>
      {!isLive && <div className="mt-1 text-xs text-[#8b949e]">{formatDuration(match.duration)}</div>}
    </Link>
  );
}

export default function HomePage() {
  const [liveGames, setLiveGames] = useState<LiveGame[]>([]);
  const [proMatches, setProMatches] = useState<ProMatch[]>([]);
  const [heroes, setHeroes] = useState<Record<string, { name: string }>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'live' | 'upcoming'>('live');

  useEffect(() => {
    async function load() {
      try {
        const [live, pro, heroData] = await Promise.all([
          fetchLiveGames(),
          fetchProMatches(),
          fetchHeroes(),
        ]);
        setLiveGames(live.filter((g: LiveGame & { deactivate_time?: number }) => g.game_time >= 0 && (g.deactivate_time === 0 || !g.deactivate_time)));
        setProMatches(pro.slice(0, 30));
        setHeroes(heroData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#7cb342] border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Matches</h1>
        <div className="flex rounded-lg bg-[#161b22] p-1">
          <button
            onClick={() => setActiveTab('live')}
            className={`rounded px-4 py-2 text-sm font-medium transition ${
              activeTab === 'live' ? 'bg-[#7cb342] text-black' : 'text-[#8b949e] hover:text-white'
            }`}
          >
            Live
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`rounded px-4 py-2 text-sm font-medium transition ${
              activeTab === 'upcoming' ? 'bg-[#7cb342] text-black' : 'text-[#8b949e] hover:text-white'
            }`}
          >
            Recent / Pro
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {activeTab === 'live' &&
          liveGames.slice(0, 20).map((game) => (
            <MatchCard key={game.match_id} game={game} heroes={heroes} />
          ))}
        {activeTab === 'live' && liveGames.length === 0 && (
          <div className="rounded-xl border border-[#21262d] bg-[#161b22] p-12 text-center text-[#8b949e]">
            No live matches at the moment
          </div>
        )}
        {activeTab === 'upcoming' &&
          proMatches.map((match) => (
            <ProMatchCard key={match.match_id} match={match} />
          ))}
      </div>
    </div>
  );
}
