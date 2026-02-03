from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.prematch import PrematchRequest, PrematchResponse
from app.schemas.draft import DraftRequest, DraftResponse
from app.schemas.live import LiveUpdateRequest, LiveUpdateResponse
from app.schemas.prediction import FullPredictionRequest, WinProbabilityResponse
from app.services.prematch import prematch_win_probability
from app.services.draft import draft_win_probability
from app.services.live import live_win_probability
from app.services.opendota import get_live_games, get_match, get_heroes_constants, get_pro_matches
from app.core.sync import sync_hero_stats, sync_item_timings

router = APIRouter(prefix="/api", tags=["analysis"])


@router.post("/prematch", response_model=PrematchResponse)
async def analyze_prematch(req: PrematchRequest):
    """Pre-match win probability based on team form, H2H, and rating."""
    result = await prematch_win_probability(req.radiant_team_id, req.dire_team_id)
    return PrematchResponse(**result)


@router.post("/draft", response_model=DraftResponse)
async def analyze_draft(req: DraftRequest):
    """Draft win probability: hero WR, player WR, versus WR, synergy."""
    rad = [{"hero_id": p.hero_id, "account_id": p.account_id or 0} for p in req.radiant_picks]
    dire = [{"hero_id": p.hero_id, "account_id": p.account_id or 0} for p in req.dire_picks]
    result = await draft_win_probability(rad, dire)
    return DraftResponse(**result)


@router.post("/live", response_model=LiveUpdateResponse)
async def analyze_live(req: LiveUpdateRequest, db: Session = Depends(get_db)):
    """
    Real-time win probability. Call every ~10s during live match.
    Pass prematch_probability and draft_probability from earlier analysis.
    """
    pl_items = [
        {
            "hero_id": p.hero_id,
            "account_id": p.account_id,
            "items": p.items or [],
            "purchase_log": p.purchase_log or [],
        }
        for p in req.player_items
    ]
    result = live_win_probability(
        match_id=req.match_id,
        game_time=req.game_time,
        radiant_gold_lead=req.radiant_gold_lead,
        radiant_xp_lead=req.radiant_xp_lead,
        towers_destroyed=req.towers_destroyed,
        player_items=pl_items,
        draft_probability=req.draft_probability,
        prematch_probability=req.prematch_probability,
        db=db,
    )
    return LiveUpdateResponse(**result)


@router.get("/live/games")
async def list_live_games():
    """List currently live games from OpenDota."""
    return await get_live_games()


@router.get("/constants/heroes")
async def heroes_constants():
    """Hero IDs and names for icons."""
    return await get_heroes_constants()


@router.get("/pro-matches")
async def pro_matches(less_than_match_id: int | None = None):
    """Recent/upcoming pro matches."""
    return await get_pro_matches(less_than_match_id)


@router.get("/match/{match_id}")
async def get_match_data(match_id: int):
    """Fetch match data (gold/xp/towers) for live tracking."""
    return await get_match(match_id)


@router.post("/prediction/full", response_model=WinProbabilityResponse)
async def full_prediction(req: FullPredictionRequest, db: Session = Depends(get_db)):
    """
    Complete win probability pipeline:
    1. Pre-match (teams, form, H2H, rating)
    2. Draft (hero WR, player WR, versus WR, synergy per pick)
    3. Combined pre+draft
    4. Live state (gold, XP, towers, item timing if game_time > 0)
    """
    pre = await prematch_win_probability(req.radiant_team_id, req.dire_team_id)
    prematch_prob = pre["radiant_win_probability"]
    pre_components = pre.get("components", {})

    draft_prob = 0.5
    draft_breakdown = None
    if req.radiant_picks and req.dire_picks:
        rad = [{"hero_id": p["hero_id"], "account_id": p.get("account_id") or 0} for p in req.radiant_picks]
        dire = [{"hero_id": p["hero_id"], "account_id": p.get("account_id") or 0} for p in req.dire_picks]
        draft_result = await draft_win_probability(rad, dire)
        draft_prob = draft_result["radiant_win_probability"]
        draft_breakdown = {
            "radiant_pick_scores": draft_result.get("radiant_pick_scores", []),
            "dire_pick_scores": draft_result.get("dire_pick_scores", []),
            "radiant_pick_breakdown": draft_result.get("radiant_pick_breakdown", []),
            "dire_pick_breakdown": draft_result.get("dire_pick_breakdown", []),
            "draft_matchup_wr": draft_result.get("draft_matchup_wr"),
        }

    combined = 0.6 * prematch_prob + 0.4 * draft_prob

    live_prob = None
    item_factor = None
    live_components = None
    if req.game_time > 0 and req.match_id:
        pl_items = req.player_items or []
        live_result = live_win_probability(
            match_id=req.match_id,
            game_time=req.game_time,
            radiant_gold_lead=req.radiant_gold_lead,
            radiant_xp_lead=req.radiant_xp_lead,
            towers_destroyed=req.towers_destroyed,
            player_items=pl_items,
            draft_probability=draft_prob,
            prematch_probability=prematch_prob,
            db=db,
        )
        live_prob = live_result["radiant_win_probability"]
        item_factor = live_result["components"].get("item_timing_multiplier")
        live_components = live_result.get("components", {})

    final = live_prob if live_prob is not None else combined
    final = max(0.01, min(0.99, final))

    return WinProbabilityResponse(
        match_id=req.match_id,
        pre_match_probability=prematch_prob,
        pre_match_components=pre_components,
        draft_probability=draft_prob,
        draft_breakdown=draft_breakdown,
        combined_pre_draft_probability=combined,
        live_state_probability=live_prob,
        live_components=live_components,
        item_timing_factor=item_factor,
        final_win_probability=final,
        radiant_win=final,
        dire_win=1 - final,
    )


@router.post("/sync/init")
async def initialize_data(db: Session = Depends(get_db)):
    """Initial sync: hero stats."""
    await sync_hero_stats(db)
    return {"status": "Hero stats synchronized"}


@router.post("/sync/item-timings")
async def sync_items(hero_id: int, item_name: str, db: Session = Depends(get_db)):
    """Sync item timing win rates for a hero+item."""
    await sync_item_timings(db, hero_id, item_name)
    return {"status": f"Item timings synced for hero {hero_id}, item {item_name}"}
