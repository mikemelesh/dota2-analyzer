"""OpenDota API client - https://docs.opendota.com/"""
import asyncio
import time
import httpx
from typing import Any

from app.core.config import settings

OPENDOTA_BASE = "https://api.opendota.com/api"

# In-memory cache for rarely-changing data (hero stats, heroes constants)
# TTL in seconds
_cache: dict[str, tuple[Any, float]] = {}
CACHE_TTL_HERO_STATS = 3600  # 1 hour
CACHE_TTL_HEROES = 86400  # 24 hours
CACHE_TTL_TEAM = 300  # 5 minutes
CACHE_TTL_TEAM_MATCHES = 120  # 2 minutes
CACHE_TTL_HERO_MATCHUPS = 1800  # 30 minutes
CACHE_TTL_PLAYER_HEROES = 300  # 5 minutes
_cache_lock = asyncio.Lock()


def _add_api_key(params: dict | None) -> dict:
    """Add API key to query parameters if configured."""
    p = dict(params) if params else {}
    if settings.OPENDOTA_API_KEY:
        p["api_key"] = settings.OPENDOTA_API_KEY
    return p


async def get(path: str, params: dict | None = None, cache_key: str | None = None, cache_ttl: float | None = None) -> Any:
    if cache_key and cache_ttl:
        async with _cache_lock:
            if cache_key in _cache:
                data, expiry = _cache[cache_key]
                if time.monotonic() < expiry:
                    return data

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(
            f"{OPENDOTA_BASE}{path}",
            params=_add_api_key(params),
            headers={"Accept": "application/json"},
        )
        r.raise_for_status()
        data = r.json()

    if cache_key and cache_ttl:
        async with _cache_lock:
            _cache[cache_key] = (data, time.monotonic() + cache_ttl)

    return data


# --- Hero data ---
async def get_hero_stats() -> list[dict]:
    return await get("/heroStats", cache_key="hero_stats", cache_ttl=CACHE_TTL_HERO_STATS)


async def get_hero_matchups(hero_id: int) -> list[dict]:
    return await get(f"/heroes/{hero_id}/matchups", cache_key=f"hero_matchups:{hero_id}", cache_ttl=CACHE_TTL_HERO_MATCHUPS)


async def get_heroes() -> list[dict]:
    return await get("/heroes", cache_key="heroes", cache_ttl=CACHE_TTL_HEROES)


# --- Team data ---
async def get_team(team_id: int) -> dict:
    return await get(f"/teams/{team_id}", cache_key=f"team:{team_id}", cache_ttl=CACHE_TTL_TEAM)


async def get_team_matches(team_id: int) -> list[dict]:
    data = await get(f"/teams/{team_id}/matches", cache_key=f"team_matches:{team_id}", cache_ttl=CACHE_TTL_TEAM_MATCHES)
    if isinstance(data, list):
        return data[:50]
    if isinstance(data, dict):
        return list(data.values())[:50] if data else []
    return []


# --- Player data ---
async def get_player_heroes(account_id: int, limit: int = 100) -> list[dict]:
    return await get(f"/players/{account_id}/heroes", {"limit": limit}, cache_key=f"player_heroes:{account_id}:{limit}", cache_ttl=CACHE_TTL_PLAYER_HEROES)


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
    return await get("/constants/heroes", cache_key="constants/heroes", cache_ttl=CACHE_TTL_HEROES)


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
