# Dota 2 Win Rate Analyzer

FastAPI app that analyzes win probability at different stages of a Dota 2 match using the [OpenDota API](https://docs.opendota.com/).

## Features

### 1. Pre-match analysis
- **Team form**: Recent match results
- **Head-to-head**: Historical results between the two teams
- **Team rating**: Elo-style probability based on ratings

### 2. Draft analysis (during pick phase)
- **Hero win rate**: Current patch pro/pub stats
- **Player hero win rate**: Per-player performance on each hero
- **Versus win rate**: Hero vs hero matchup data
- **Synergy**: Historical win rate of similar lineups (`findMatches`)

### 3. Combined pre-match + draft
Blended probability (60% pre-match, 40% draft).

### 4. Real-time live analysis (~10s intervals)
- Gold lead
- XP lead
- Towers/barracks destroyed
- Picks win rate
- Teams’ recent form
- Item timing win rate (when items are bought at specific minutes)

## Setup

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Optional: create `.env` for config:

```
DATABASE_URL=sqlite:///./dota2_analyzer.db
OPENDOTA_API_KEY=your_key   # Optional, for higher rate limits
```

## Run

**Backend only:**
```bash
uvicorn app.main:app --reload
```

**With frontend (development):**
```bash
# Terminal 1: backend
uvicorn app.main:app --reload

# Terminal 2: frontend (with proxy to backend)
cd frontend && npm run dev
```
Then open http://localhost:5173

**Production (serves built frontend from FastAPI):**
```bash
cd frontend && npm run build
cd .. && uvicorn app.main:app
```
Then open http://localhost:8000

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/sync/init` | Sync hero stats from OpenDota |
| POST | `/api/prematch` | Pre-match win probability |
| POST | `/api/draft` | Draft-phase win probability |
| POST | `/api/live` | Real-time win probability (poll every ~10s) |
| POST | `/api/prediction/full` | Full pipeline (prematch + draft + optional live) |
| GET | `/api/live/games` | List live games |
| GET | `/api/match/{id}` | Match details |
| POST | `/api/sync/item-timings` | Sync item timing data (hero_id, item_name) |

## Example requests

**Pre-match** (team IDs from OpenDota, e.g. 7119078, 726228):
```json
POST /api/prematch
{"radiant_team_id": 7119078, "dire_team_id": 726228}
```

**Draft** (hero_id from OpenDota, account_id = Steam32 ID):
```json
POST /api/draft
{
  "radiant_picks": [{"hero_id": 11, "account_id": 123456}, ...],
  "dire_picks": [{"hero_id": 21, "account_id": 0}, ...]
}
```

**Live** (call every 10s during match):
```json
POST /api/live
{
  "match_id": 12345,
  "game_time": 1200,
  "radiant_gold_lead": 5000,
  "radiant_xp_lead": 3000,
  "towers_destroyed": {"radiant": 1, "dire": 2},
  "prematch_probability": 0.55,
  "draft_probability": 0.52,
  "player_items": [...]
}
```

## Frontend

- **Live & upcoming matches** — Browse live games and recent pro matches
- **Match detail** — Win rate by category (pre-match, draft, combined, live, final)
- **Interactive map** — Tower status (Radiant/Dire standing/destroyed)
- **Hero grid** — Icons, nicknames, networth, XP; gray when dead (parsed matches)
- **Team stats** — Gold lead, XP lead, score

## Project structure

```
app/
├── api/routes.py      # API endpoints
├── core/
│   ├── config.py      # Settings
│   └── sync.py        # Hero/item sync
├── db/session.py      # Database
├── models/            # SQLAlchemy models
├── schemas/           # Pydantic request/response
├── services/
│   ├── opendota.py    # OpenDota API client
│   ├── prematch.py    # Pre-match logic
│   ├── draft.py       # Draft analysis
│   └── live.py        # Live analysis
└── main.py
frontend/           # React + Vite + Tailwind
├── src/
│   ├── components/  # Layout, DotaMap, WinRateCard
│   ├── lib/         # api, heroes, towerState
│   └── pages/       # HomePage, MatchDetailPage
└── ...
```
