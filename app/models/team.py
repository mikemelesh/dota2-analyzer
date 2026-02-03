from sqlalchemy import Column, Integer, String, Float, JSON
from app.db.session import Base


class Team(Base):
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    tag = Column(String, nullable=True)
    rating = Column(Float, nullable=True)
    wins = Column(Integer, nullable=True)
    losses = Column(Integer, nullable=True)
    last_matches_data = Column(JSON, nullable=True)
    last_match_time = Column(Integer, nullable=True)
