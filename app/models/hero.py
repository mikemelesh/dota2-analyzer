from sqlalchemy import Column, Integer, String, Float, JSON
from sqlalchemy.ext.declarative import declarative_base

class HeroStat(Base):
    __tablename__ = "hero_stats"
    id = Column(Integer, primary_key=True) # OpenDota hero_id
    name = Column(String)
    localized_name = Column(String)
    current_patch_win_rate = Column(Float)
    synergy_matrix = Column(JSON)  # Stores win rates with other hero IDs
    counter_matrix = Column(JSON)  # Stores win rates against other hero IDs