"""OpenDota API client - https://docs.opendota.com/"""
import httpx
from typing import Any

from app.core.config import settings

OPENDOTA_BASE = "https://api.opendota.com/api"


def _headers() -> dict:
    h = {"Accept": "application/json"}
    if settings.OPENDOTA_API_KEY:
        h["x-api-key"] = settings.OPENDOTA_API_KEY
    return h


async def get(path: str, params: dict | None = None) -> Any:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(
            f"{OPENDOTA_BASE}{path}",
            params=params or {},
            headers=_headers(),
        )
        r.raise_for_status()
        return r.json()


# --- Hero data ---
async def get_hero_stats() -> list[dict]:
    return await get("/heroStats")


async def get_hero_matchups(hero_id: int) -> list[dict]:
    return await get(f"/heroes/{hero_id}/matchups")


async def get_heroes() -> list[dict]:
    return await get("/heroes")


# --- Team data ---
async def get_team(team_id: int) -> dict:
    return await get(f"/teams/{team_id}")


async def get_team_matches(team_id: int) -> list[dict]:
    data = await get(f"/teams/{team_id}/matches")
    if isinstance(data, list):
        return data[:50]
    if isinstance(data, dict):
        return list(data.values())[:50] if data else []
    return []


# --- Player data ---
async def get_player_heroes(account_id: int, limit: int = 100) -> list[dict]:
    return await get(f"/players/{account_id}/heroes", {"limit": limit})


async def get_player_wl(account_id: int, **params) -> dict:
    return await get(f"/players/{account_id}/wl", params)


# --- Match data ---
async def get_match(match_id: int) -> dict:
    return await get(f"/matches/{match_id}")


async def find_matches(team_a_heroes: list[int], team_b_heroes: list[int]) -> list[dict]:
    params = {
        "teamA": ",".join(map(str, team_a_heroes)),
        "teamB": ",".join(map(str, team_b_heroes)),
    }
    return await get("/findMatches", params)


# --- Live games ---
async def get_live_games() -> list[dict]:
    return await get("/live")


# --- Constants ---
async def get_heroes_constants() -> dict:
    return await get("/constants/heroes")


# --- Pro matches ---
async def get_pro_matches(less_than_match_id: int | None = None) -> list[dict]:
    params = {}
    if less_than_match_id:
        params["less_than_match_id"] = less_than_match_id
    return await get("/proMatches", params if params else None)


# --- Item timings ---
async def get_item_timings(hero_id: int | None = None, item: str | None = None) -> list[dict]:
    params = {}
    if hero_id is not None:
        params["hero_id"] = hero_id
    if item:
        params["item"] = item
    return await get("/scenarios/itemTimings", params if params else None)
