"""Pre-match win probability based on team form, H2H, and recent matches."""
from app.services.opendota import get_team, get_team_matches


def _team_won(m: dict, is_radiant_team: bool) -> bool:
    """Team won if (was radiant and radiant won) or (was dire and dire won)."""
    radiant = m.get("radiant", True)
    radiant_win = m.get("radiant_win", False)
    return (radiant and radiant_win) or (not radiant and not radiant_win)


async def get_team_form(team_id: int, last_n: int = 10) -> tuple[float, list[dict], dict]:
    """Returns (win_rate, matches, team). Uses recent matches for form."""
    try:
        team = await get_team(team_id)
    except Exception:
        return (0.5, [], {})
    try:
        matches = await get_team_matches(team_id)
    except Exception:
        matches = []
    if not isinstance(matches, list):
        matches = list(matches.values()) if isinstance(matches, dict) else []
    recent = matches[:last_n]
    if not recent:
        wins = team.get("wins") or 0
        losses = team.get("losses") or 0
        total = wins + losses
        return (wins / total if total > 0 else 0.5, [], team)
    wins = sum(1 for m in recent if isinstance(m, dict) and _team_won(m, True))
    return (wins / len(recent), recent, team)


def _head_to_head_from_matches(rad_matches: list[dict], dire_team_id: int) -> float | None:
    """Win rate of radiant vs dire from past matches. Returns None if no H2H."""
    h2h = [m for m in rad_matches if isinstance(m, dict) and m.get("opposing_team_id") == dire_team_id]
    if not h2h:
        return None
    radiant_wins = sum(1 for m in h2h if _team_won(m, True))
    return radiant_wins / len(h2h)


async def prematch_win_probability(radiant_team_id: int, dire_team_id: int) -> dict:
    """
    Pre-match win probability for Radiant.
    Combines: team form (recent matches) + head-to-head + overall rating.
    Fetches each team+matches once (no duplicate OpenDota calls).
    """
    rad_form, rad_matches, rad_team = await get_team_form(radiant_team_id)
    dire_form, dire_matches, dire_team = await get_team_form(dire_team_id)

    rad_rating = rad_team.get("rating") or 1000
    dire_rating = dire_team.get("rating") or 1000
    # Elo-style: P(radiant wins) = 1 / (1 + 10^((dire-rad)/400))
    rating_diff = dire_rating - rad_rating
    rating_prob = 1 / (1 + 10 ** (rating_diff / 400))

    form_prob = rad_form if rad_form != 0.5 or dire_form == 0.5 else (1 - dire_form)
    if rad_matches and dire_matches:
        form_prob = (rad_form + (1 - dire_form)) / 2
    elif rad_matches:
        form_prob = rad_form
    elif dire_matches:
        form_prob = 1 - dire_form
    else:
        form_prob = 0.5

    h2h_prob = _head_to_head_from_matches(rad_matches, dire_team_id)

    # Weighted blend: rating 40%, form 40%, H2H 20% (if available)
    weights = {"rating": 0.4, "form": 0.4, "h2h": 0.2}
    if h2h_prob is None:
        weights = {"rating": 0.5, "form": 0.5, "h2h": 0.0}
        h2h_prob = 0.5

    prob = (
        weights["rating"] * rating_prob
        + weights["form"] * form_prob
        + weights["h2h"] * (h2h_prob or 0.5)
    )
    prob = max(0.01, min(0.99, prob))

    return {
        "radiant_win_probability": round(prob, 4),
        "dire_win_probability": round(1 - prob, 4),
        "components": {
            "rating_probability": round(rating_prob, 4),
            "form_probability": round(form_prob, 4),
            "h2h_probability": round(h2h_prob or 0.5, 4) if h2h_prob is not None else None,
        },
        "radiant_form": rad_form,
        "dire_form": dire_form,
        "radiant_matches_analyzed": len(rad_matches),
        "dire_matches_analyzed": len(dire_matches),
    }
