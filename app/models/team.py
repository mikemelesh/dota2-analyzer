from sqlalchemy import Column, Integer, String, Float, JSON
from app.db.base import Base

class Team(Base):
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    rating = Column(Float)
    last_matches_data = Column(JSON)