from pydantic import BaseModel
from typing import List

class HeroSelection(BaseModel):
    hero_id: int
    player_id: int
    player_hero_win_rate: float

class DraftState(BaseModel):
    radiant_team: List[HeroSelection]
    dire_team: List[HeroSelection]
    patch_version: str