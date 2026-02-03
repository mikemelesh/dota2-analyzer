from pydantic import BaseModel
from typing import List


class HeroPick(BaseModel):
    hero_id: int
    account_id: int | None = None


class DraftRequest(BaseModel):
    radiant_picks: List[HeroPick]
    dire_picks: List[HeroPick]


class PickBreakdown(BaseModel):
    hero_wr: float
    player_wr: float
    versus_wr: float


class DraftResponse(BaseModel):
    radiant_win_probability: float
    dire_win_probability: float
    draft_matchup_wr: float | None
    radiant_pick_scores: List[float]
    dire_pick_scores: List[float]
    radiant_pick_breakdown: List[dict] = []
    dire_pick_breakdown: List[dict] = []
