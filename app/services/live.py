"""Real-time live match win probability based on gold, XP, towers, items."""
import math
from sqlalchemy.orm import Session

from app.models.analytics import ItemTimingScenario


def _sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-x))


def game_state_probability(
    game_time: int,
    radiant_gold_lead: int,
    radiant_xp_lead: int,
    towers_radiant_down: int,
    towers_dire_down: int,
    radiant_barracks: int = 6,
    dire_barracks: int = 6,
) -> float:
    """
    Win probability for Radiant based on current game state.
    Uses sigmoid on normalized gold/XP leads. Tower/barracks add adjustment.
    """
    # Normalize by time - early game swings matter less
    time_factor = min(1.0, game_time / 3600)
    gold_per_min = radiant_gold_lead / (game_time / 60) if game_time > 0 else 0
    xp_per_min = radiant_xp_lead / (game_time / 60) if game_time > 0 else 0

    # Gold lead: ~100 GPM advantage ~ 5% win prob
    gold_score = gold_per_min / 20
    xp_score = xp_per_min / 30
    raw = 0.5 + 0.15 * (gold_score + xp_score) * time_factor

    tower_diff = towers_dire_down - towers_radiant_down
    raw += tower_diff * 0.03

    barracks_diff = dire_barracks - radiant_barracks
    raw += barracks_diff * 0.04

    return max(0.01, min(0.99, raw))


def item_timing_probability(
    player_items: list[dict],
    db: Session | None,
) -> float:
    """
    Adjust win prob based on item purchase timings.
    player_items: [{"hero_id": int, "account_id": int, "items": [{"name": str, "time": int}], ...}]
    Returns multiplier centered at 1.0 (1.05 = 5% more likely to win).
    """
    if not player_items or not db:
        return 1.0

    total_factor = 0.0
    count = 0
    for p in player_items:
        hero_id = p.get("hero_id")
        items = p.get("items") or p.get("purchase_log") or []
        for it in items:
            name = it.get("name") or it.get("key", "").replace("item_", "")
            time_bought = it.get("time", 0)
            if not name or time_bought <= 0:
                continue
            bucket = (time_bought // 300) * 300
            row = (
                db.query(ItemTimingScenario)
                .filter(
                    ItemTimingScenario.hero_id == hero_id,
                    ItemTimingScenario.item_name == name,
                    ItemTimingScenario.time_bucket <= time_bought + 300,
                    ItemTimingScenario.time_bucket >= time_bought - 300,
                )
                .first()
            )
            if row and row.win_rate:
                total_factor += row.win_rate - 0.5
                count += 1
    if count == 0:
        return 1.0
    avg = total_factor / count
    return 1.0 + avg * 0.2


def live_win_probability(
    match_id: int,
    game_time: int,
    radiant_gold_lead: int,
    radiant_xp_lead: int,
    towers_destroyed: dict,
    player_items: list[dict],
    draft_probability: float,
    prematch_probability: float,
    db: Session | None = None,
) -> dict:
    """
    Final live win probability combining:
    - Game state (gold, XP, towers)
    - Draft/picks win rate
    - Pre-match win rate
    - Item timing (if DB available)
    """
    towers_radiant = towers_destroyed.get("radiant", 0)
    towers_dire = towers_destroyed.get("dire", 0)
    barracks_radiant = towers_destroyed.get("radiant_barracks", 6)
    barracks_dire = towers_destroyed.get("dire_barracks", 6)

    state_prob = game_state_probability(
        game_time,
        radiant_gold_lead,
        radiant_xp_lead,
        towers_radiant,
        towers_dire,
        barracks_radiant,
        barracks_dire,
    )

    item_mult = item_timing_probability(player_items, db)

    # Weights: as game progresses, in-game state matters more
    progress = min(1.0, game_time / 2400)  # 40 min = full weight
    pre_weight = 0.4 * (1 - progress)
    draft_weight = 0.3 * (1 - progress)
    state_weight = 0.3 + 0.7 * progress

    base = (
        pre_weight * prematch_probability
        + draft_weight * draft_probability
        + state_weight * state_prob
    )
    prob = base * item_mult
    prob = max(0.01, min(0.99, prob))

    return {
        "radiant_win_probability": round(prob, 4),
        "dire_win_probability": round(1 - prob, 4),
        "components": {
            "prematch": round(prematch_probability, 4),
            "draft": round(draft_probability, 4),
            "game_state": round(state_prob, 4),
            "item_timing_multiplier": round(item_mult, 4),
        },
        "game_time_seconds": game_time,
    }
