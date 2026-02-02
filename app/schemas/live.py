from pydantic import BaseModel
from typing import List

class LiveGameUpdate(BaseModel):
    match_id: int
    game_time: int 
    radiant_gold_lead: int
    radiant_xp_lead: int
    towers_destroyed: dict 
    player_items: List[dict]