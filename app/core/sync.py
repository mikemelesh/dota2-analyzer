from sqlalchemy.orm import Session

from app.models.hero import HeroStat
from app.models.analytics import ItemTimingScenario
from app.services.opendota import get_hero_stats, get_item_timings


async def sync_hero_stats(db: Session):
    heroes = await get_hero_stats()
    for h in heroes:
        hero = db.query(HeroStat).filter(HeroStat.id == h["id"]).first()
        if not hero:
            hero = HeroStat(id=h["id"])
        hero.name = h.get("name", "")
        hero.localized_name = h.get("localized_name", "")
        hero.primary_attr = h.get("primary_attr", "")
        pro_pick = h.get("pro_pick") or 0
        hero.pro_win_rate = h["pro_win"] / pro_pick if pro_pick > 0 else 0.5
        pub_pick = h.get("pub_pick") or 0
        hero.pub_win_rate = h["pub_win"] / pub_pick if pub_pick > 0 else 0.5
        db.add(hero)
    db.commit()


async def sync_item_timings(db: Session, hero_id: int, item_name: str):
    data = await get_item_timings(hero_id=hero_id, item=item_name)
    for entry in data:
        games = int(entry.get("games", 0) or 0)
        wins = int(entry.get("wins", 0) or 0)
        wr = wins / games if games > 10 else 0.5
        scenario = ItemTimingScenario(
            hero_id=hero_id,
            item_name=entry.get("item", item_name),
            time_bucket=int(entry.get("time", 0)),
            win_rate=wr,
        )
        db.add(scenario)
    db.commit()
