"""Draft-phase analysis: hero WR, player WR, versus WR, synergy."""
import asyncio

from app.services.opendota import (
    get_hero_stats,
    get_hero_matchups,
    get_player_heroes,
    find_matches,
)


async def _hero_win_rates() -> dict[int, float]:
    stats = await get_hero_stats()
    out = {}
    for h in stats:
        pid = h.get("id") or h.get("hero_id")
        if pid is None:
            continue
        pro_pick = h.get("pro_pick") or 0
        pro_win = h.get("pro_win") or 0
        pub_pick = h.get("pub_pick") or 0
        pub_win = h.get("pub_win") or 0
        if pro_pick >= 10:
            wr = pro_win / pro_pick
        elif pub_pick >= 100:
            wr = pub_win / pub_pick
        else:
            wr = 0.5
        out[pid] = wr
    return out


async def _const(val: float):
    """Return a constant (for use when we skip an API call)."""
    return val


async def get_player_hero_win_rate(account_id: int, hero_id: int) -> float:
    heroes = await get_player_heroes(account_id)
    for h in heroes:
        if h.get("hero_id") == hero_id:
            g = h.get("games", 0)
            w = h.get("win", 0)
            return w / g if g >= 1 else 0.5
    return 0.5


async def get_versus_win_rate(hero_id: int, vs_hero_ids: list[int]) -> float:
    """Win rate of hero_id against the opposing heroes."""
    if not vs_hero_ids:
        return 0.5
    matchups = await get_hero_matchups(hero_id)
    match_map = {m["hero_id"]: m for m in matchups if "hero_id" in m}
    total_games = 0
    total_wins = 0
    for vid in vs_hero_ids:
        m = match_map.get(vid)
        if m:
            g = m.get("games_played", 0)
            w = m.get("wins", 0)
            total_games += g
            total_wins += w
    if total_games < 5:
        return 0.5
    return total_wins / total_games


async def get_draft_matchup_win_rate(radiant_hero_ids: list[int], dire_hero_ids: list[int]) -> float | None:
    """Win rate of radiant when these exact lineups played. Returns None if no history."""
    if len(radiant_hero_ids) < 5 or len(dire_hero_ids) < 5:
        return None
    try:
        matches = await find_matches(radiant_hero_ids, dire_hero_ids)
        if not matches:
            return None
        wins = sum(1 for m in matches if m.get("radiant") == m.get("radiant_win"))
        return wins / len(matches)
    except Exception:
        return None


async def draft_win_probability(
    radiant_picks: list[dict],  # [{"hero_id": int, "account_id": int}, ...]
    dire_picks: list[dict],
) -> dict:
    """
    Draft win probability for Radiant based on:
    1. Hero patch win rate
    2. Player hero win rate
    3. Versus win rate (hero vs enemy heroes)
    4. Synergy (heroes on same team)
    """
    rad_hero_ids = [p["hero_id"] for p in radiant_picks]
    dire_hero_ids = [p["hero_id"] for p in dire_picks]

    rad_pl_tasks = [
        get_player_hero_win_rate(p.get("account_id", 0), p["hero_id"]) if p.get("account_id") else _const(0.5)
        for p in radiant_picks
    ]
    dire_pl_tasks = [
        get_player_hero_win_rate(p.get("account_id", 0), p["hero_id"]) if p.get("account_id") else _const(0.5)
        for p in dire_picks
    ]
    rad_vs_tasks = [get_versus_win_rate(hid, dire_hero_ids) for hid in rad_hero_ids]
    dire_vs_tasks = [get_versus_win_rate(hid, rad_hero_ids) for hid in dire_hero_ids]

    hero_wrs, *rest = await asyncio.gather(
        _hero_win_rates(),
        *rad_pl_tasks,
        *dire_pl_tasks,
        *rad_vs_tasks,
        *dire_vs_tasks,
        get_draft_matchup_win_rate(rad_hero_ids, dire_hero_ids),
    )
    n_rad, n_dire = len(radiant_picks), len(dire_picks)
    rad_pl_wrs = list(rest[:n_rad])
    dire_pl_wrs = list(rest[n_rad : n_rad + n_dire])
    rad_vs_wrs = list(rest[n_rad + n_dire : n_rad + n_dire + n_rad])
    dire_vs_wrs = list(rest[n_rad + n_dire + n_rad : -1])
    draft_matchup_wr = rest[-1]

    rad_scores = []
    rad_breakdown = []
    for i, p in enumerate(radiant_picks):
        hid = p["hero_id"]
        h_wr = hero_wrs.get(hid, 0.5)
        pl_wr = rad_pl_wrs[i] if i < len(rad_pl_wrs) else 0.5
        vs_wr = rad_vs_wrs[i] if i < len(rad_vs_wrs) else 0.5
        score = h_wr * 0.35 + pl_wr * 0.35 + vs_wr * 0.3
        rad_scores.append(score)
        rad_breakdown.append({"hero_wr": h_wr, "player_wr": pl_wr, "versus_wr": vs_wr})

    dire_scores = []
    dire_breakdown = []
    for i, p in enumerate(dire_picks):
        hid = p["hero_id"]
        h_wr = hero_wrs.get(hid, 0.5)
        pl_wr = dire_pl_wrs[i] if i < len(dire_pl_wrs) else 0.5
        vs_wr = dire_vs_wrs[i] if i < len(dire_vs_wrs) else 0.5
        score = h_wr * 0.35 + pl_wr * 0.35 + vs_wr * 0.3
        dire_scores.append(score)
        dire_breakdown.append({"hero_wr": h_wr, "player_wr": pl_wr, "versus_wr": vs_wr})

    rad_avg = sum(rad_scores) / len(rad_scores) if rad_scores else 0.5
    dire_avg = sum(dire_scores) / len(dire_scores) if dire_scores else 0.5

    draft_matchup_wr = await get_draft_matchup_win_rate(rad_hero_ids, dire_hero_ids)

    # If we have historical draft matchup data, blend it in
    if draft_matchup_wr is not None:
        rad_final = 0.6 * rad_avg + 0.4 * draft_matchup_wr
        dire_final = 0.6 * dire_avg + 0.4 * (1 - draft_matchup_wr)
    else:
        rad_final = rad_avg
        dire_final = dire_avg

    total = rad_final + dire_final
    rad_prob = rad_final / total if total > 0 else 0.5
    rad_prob = max(0.01, min(0.99, rad_prob))

    return {
        "radiant_win_probability": round(rad_prob, 4),
        "dire_win_probability": round(1 - rad_prob, 4),
        "draft_matchup_wr": round(draft_matchup_wr, 4) if draft_matchup_wr is not None else None,
        "radiant_pick_scores": [round(s, 4) for s in rad_scores],
        "dire_pick_scores": [round(s, 4) for s in dire_scores],
        "radiant_pick_breakdown": [
            {k: round(v, 4) for k, v in b.items()} for b in rad_breakdown
        ],
        "dire_pick_breakdown": [
            {k: round(v, 4) for k, v in b.items()} for b in dire_breakdown
        ],
    }
