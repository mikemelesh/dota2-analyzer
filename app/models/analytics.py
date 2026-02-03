from sqlalchemy import Column, Integer, String, Float
from app.db.session import Base


class ItemTimingScenario(Base):
    __tablename__ = "item_timing_scenarios"
    id = Column(Integer, primary_key=True, autoincrement=True)
    hero_id = Column(Integer, index=True)
    item_name = Column(String, index=True)
    time_bucket = Column(Integer)
    win_rate = Column(Float)
