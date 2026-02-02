from sqlalchemy import Column, Integer, String, Float, JSON
from app.db.base import Base

class ItemTimingBenchmark(Base):
    __tablename__ = "item_timing_benchmarks"
    id = Column(Integer, primary_key=True, autoincrement=True)
    hero_id = Column(Integer)
    item_id = Column(Integer)
    minute = Column(Integer)
    expected_win_rate = Column(Float)