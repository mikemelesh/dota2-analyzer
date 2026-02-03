from pydantic import BaseModel
from typing import List, Dict, Any


class ItemPurchase(BaseModel):
    name: str | None = None
    key: str | None = None
    time: int = 0


class PlayerLiveState(BaseModel):
    hero_id: int
    account_id: int | None = None
    items: List[Dict[str, Any]] | None = None
    purchase_log: List[Dict[str, Any]] | None = None


class LiveUpdateRequest(BaseModel):
    match_id: int
    game_time: int
    radiant_gold_lead: int
    radiant_xp_lead: int
    towers_destroyed: Dict[str, int] = {}
    player_items: List[PlayerLiveState] = []
    prematch_probability: float = 0.5
    draft_probability: float = 0.5


class LiveUpdateResponse(BaseModel):
    radiant_win_probability: float
    dire_win_probability: float
    components: Dict[str, float]
    game_time_seconds: int
