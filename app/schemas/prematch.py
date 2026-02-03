from pydantic import BaseModel


class PrematchRequest(BaseModel):
    radiant_team_id: int
    dire_team_id: int


class PrematchResponse(BaseModel):
    radiant_win_probability: float
    dire_win_probability: float
    components: dict
    radiant_form: float
    dire_form: float
    radiant_matches_analyzed: int
    dire_matches_analyzed: int
