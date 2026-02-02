from pydantic import BaseModel

class WinProbabilityResponse(BaseModel):
    match_id: int
    pre_match_probability: float
    draft_probability: float
    live_state_probability: float
    item_timing_probability: float
    final_win_probability: float