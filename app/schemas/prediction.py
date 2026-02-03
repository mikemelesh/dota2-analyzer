from pydantic import BaseModel
from typing import List, Dict, Any


class FullPredictionRequest(BaseModel):
    radiant_team_id: int
    dire_team_id: int
    radiant_picks: List[Dict[str, Any]] = []  # [{"hero_id": int, "account_id": int}]
    dire_picks: List[Dict[str, Any]] = []
    match_id: int | None = None
    game_time: int = 0
    radiant_gold_lead: int = 0
    radiant_xp_lead: int = 0
    towers_destroyed: Dict[str, int] = {}
    player_items: List[Dict[str, Any]] = []


class WinProbabilityResponse(BaseModel):
    match_id: int | None
    pre_match_probability: float
    pre_match_components: dict | None = None  # rating, form, h2h
    draft_probability: float
    draft_breakdown: dict | None = None  # radiant/dire pick scores + per-hero breakdown
    combined_pre_draft_probability: float
    live_state_probability: float | None = None
    live_components: dict | None = None  # prematch, draft, game_state, item_timing
    item_timing_factor: float | None = None
    final_win_probability: float
    radiant_win: float
    dire_win: float
