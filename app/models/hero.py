from sqlalchemy import Column, Integer, String, Float, JSON
from app.db.session import Base


class HeroStat(Base):
    __tablename__ = "hero_stats"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    localized_name = Column(String)
    primary_attr = Column(String)
    pro_win_rate = Column(Float)
    pub_win_rate = Column(Float)
    synergy_matrix = Column(JSON, nullable=True)
    counter_matrix = Column(JSON, nullable=True)
