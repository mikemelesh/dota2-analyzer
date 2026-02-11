# Dota 2 Match Analyzer

A real-time Dota 2 match analyzer that provides win probability predictions based on multiple factors including team history, draft analysis, and live game state.

## Features

- **Live Match Tracking**: View all ongoing professional Dota 2 matches with real-time updates
- **Match Analysis**: Detailed breakdown of any match with win probability predictions
- **Tower Status Map**: Visual minimap showing which towers are standing/destroyed
- **Player Statistics**: KDA, gold, XP, CS, hero levels, and death status
- **Prediction Accuracy Tracking**: See how well predictions perform against actual results

## How Win Predictions Work

The analyzer calculates win probabilities using multiple layers of analysis, each weighted differently based on the game state.

### 1. Pre-Match Analysis (Before Draft)

Pre-match probability is calculated from historical team data:

| Factor | Weight | Description |
|--------|--------|-------------|
| **Team Rating (Elo)** | 40-50% | Uses an Elo-style calculation based on team ratings: `P = 1 / (1 + 10^((rating_diff)/400))` |
| **Recent Form** | 40-50% | Win rate from the team's last 10 matches. Combines both teams' form: `(radiant_form + (1 - dire_form)) / 2` |
| **Head-to-Head** | 20% | Historical win rate when these two teams have faced each other (only if H2H data exists) |

**Formula:**
```
pre_match = 0.4 * rating_prob + 0.4 * form_prob + 0.2 * h2h_prob
```
*Note: If no H2H data exists, weights are redistributed to 50/50 between rating and form.*

### 2. Draft Analysis (After Picks)

Draft probability analyzes each hero pick using 3 factors:

| Factor | Weight | Description |
|--------|--------|-------------|
| **Hero Patch Win Rate** | 35% | The hero's overall win rate in the current patch (pro games if available, else pub games) |
| **Player Hero Win Rate** | 35% | The specific player's historical performance on this hero |
| **Versus Win Rate** | 30% | How this hero performs against the enemy team's heroes |

**Per-hero score calculation:**
```
hero_score = 0.35 * hero_wr + 0.35 * player_wr + 0.30 * versus_wr
```

**Team draft probability:**
```
team_avg_score = average(all_hero_scores)
draft_prob = radiant_avg / (radiant_avg + dire_avg)
```

Additionally, if historical data exists for the exact hero matchup (all 10 heroes), it's blended in:
```
final_draft = 0.6 * team_avg + 0.4 * historical_matchup_wr
```

### 3. Combined Pre-Draft Probability

Before the game starts (or early game):
```
combined = 0.6 * pre_match + 0.4 * draft
```

### 4. Live Game Analysis (During Match)

Live probability incorporates real-time game state:

| Factor | Description |
|--------|-------------|
| **Gold Lead** | Normalized by game time. ~100 GPM advantage ≈ 5% win probability boost |
| **XP Lead** | Normalized by game time. Similar scaling to gold but weighted slightly less |
| **Towers** | Each tower difference adds ~3% to win probability |
| **Barracks** | Each barracks difference adds ~4% to win probability |

**Game state formula:**
```
time_factor = min(1.0, game_time / 3600)  // Scales from 0 to 1 over 60 minutes
gold_score = gold_per_min / 20
xp_score = xp_per_min / 30
raw = 0.5 + 0.15 * (gold_score + xp_score) * time_factor
raw += tower_diff * 0.03
raw += barracks_diff * 0.04
```

**Item Timing Factor:**
When item purchase data is available, the system adjusts based on how well players hit item timing benchmarks compared to historical data. A player getting a key item earlier than average boosts their team's probability.

### 5. Final Win Probability

The final probability dynamically weights factors based on game progress:

```
progress = min(1.0, game_time / 2400)  // 0 at start, 1 at 40 minutes

pre_weight = 0.4 * (1 - progress)      // 40% → 0% over 40 mins
draft_weight = 0.3 * (1 - progress)     // 30% → 0% over 40 mins  
state_weight = 0.3 + 0.7 * progress     // 30% → 100% over 40 mins

final = (pre_weight * prematch + draft_weight * draft + state_weight * game_state) * item_timing_multiplier
```

**What this means:**
- At game start: Pre-match (40%) + Draft (30%) + Game state (30%)
- At 20 minutes: Pre-match (20%) + Draft (15%) + Game state (65%)
- At 40+ minutes: Game state dominates (~100%)

### Understanding the Display

All probabilities are internally calculated as **Radiant win probability** (0-1). The UI displays:

- **Percentage shown**: Always the **favored team's** win probability
- **Color**: Green = Radiant favored, Red = Dire favored

Example:
- If Radiant win probability = 0.65 → Shows "65% Radiant favored"
- If Radiant win probability = 0.12 → Shows "88% Dire favored" (because Dire has 1 - 0.12 = 0.88)

## Data Sources

All data is fetched from the [OpenDota API](https://docs.opendota.com/):

- `/live` - Current live matches
- `/proMatches` - Recent professional matches
- `/matches/{id}` - Detailed match data
- `/teams/{id}` - Team information and ratings
- `/teams/{id}/matches` - Team match history
- `/heroStats` - Hero win rates and pick rates
- `/heroes/{id}/matchups` - Hero vs hero statistics
- `/players/{id}/heroes` - Player hero statistics
- `/findMatches` - Historical lineup matchups
- `/scenarios/itemTimings` - Item timing benchmarks

## Tower Status Parsing

Tower status is encoded as a bitmask where:
- **Bit = 1**: Tower is STANDING
- **Bit = 0**: Tower is DESTROYED

**Bit order (from LSB):**
```
0: Top T1    3: Mid T1    6: Bot T1    9:  Ancient T4 Top
1: Top T2    4: Mid T2    7: Bot T2    10: Ancient T4 Bot
2: Top T3    5: Mid T3    8: Bot T3
```

For live games, `building_state` combines both teams:
- Bits 0-10: Radiant towers
- Bits 11-21: Dire towers

## API Configuration

To get higher rate limits, add your OpenDota API key to the backend configuration:

```python
# app/core/config.py
OPENDOTA_API_KEY: str | None = "your-api-key-here"
```

The API key is passed as a query parameter: `?api_key=YOUR_KEY`

## Project Structure

```
.
├── app/
│   ├── api/
│   │   └── routes.py          # API endpoints
│   ├── services/
│   │   ├── opendota.py        # OpenDota API client
│   │   ├── prematch.py        # Pre-match analysis
│   │   ├── draft.py           # Draft analysis
│   │   └── live.py            # Live game analysis
│   ├── models/
│   │   └── analytics.py       # Database models
│   └── schemas/
│       └── prediction.py      # Response schemas
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── HomePage.tsx       # Match list
    │   │   └── MatchDetailPage.tsx # Match details
    │   ├── components/
    │   │   ├── DotaMap.tsx        # Tower minimap
    │   │   └── WinRateCard.tsx    # Win rate display
    │   └── lib/
    │       ├── api.ts             # API client
    │       ├── heroes.ts          # Hero utilities
    │       └── towerState.ts      # Tower parsing
    └── package.json
```

## Running the Application

### Backend
```bash
cd app
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Limitations & Future Improvements

### Current Limitations
- Item timing analysis requires a local database with historical data
- Draft analysis doesn't account for hero synergies within a team
- No consideration for player positioning/roles

### Potential Improvements
- Add hero synergy calculations (e.g., Io + Tiny combo bonus)
- Track player recent form (not just hero performance)
- Analyze team fight compositions
- Consider game patch changes and meta shifts
- Add machine learning model trained on historical match data

## License

MIT
