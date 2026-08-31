# SongSpot.in — Indian Song Guessing Game

SongSpot.in is a full-stack music guessing game built around a simple challenge: **how quickly can you identify an Indian song from a very short preview?**

Players choose a category, hear progressively longer clips, enter a guess, and earn more points for recognizing the song earlier.

```text
0.1 sec -> 0.5 sec -> 2 sec -> 5 sec -> 8 sec
100 pts    80 pts     60 pts   40 pts   20 pts
```

The current repository is an MVP foundation with a React/TypeScript frontend, FastAPI game API, seeded Indian-music metadata, and Docker infrastructure for PostgreSQL, Redis, and VPS deployment.

> Commercial recordings are not bundled in this repository. Production audio must come from licensed preview URLs or another legally permitted source.

## Core Game Loop

```text
Open SongSpot.in
      |
      v
Choose a category
      |
      v
Start a round
      |
      v
Hear 0.1s preview
      |
      +--> Guess correctly -> 100 points
      |
      v
Reveal 0.5s -> 2s -> 5s -> 8s
      |
      v
Guess / reveal answer
      |
      v
Score + Next Song
```

## What Is Implemented

- React + TypeScript frontend powered by Vite
- FastAPI backend
- Indian-song category system
- progressive reveal stages: `0.1`, `0.5`, `2`, `5`, and `8` seconds
- stage-based scoring: `100`, `80`, `60`, `40`, and `20` points
- song search endpoint
- category-filtered random rounds
- answer checking with song aliases
- answer reveal endpoint
- seeded song metadata for MVP development
- placeholder generated tone when a licensed preview is unavailable
- Docker Compose stack for frontend, backend, PostgreSQL, and Redis
- Nginx-oriented deployment configuration for a VPS

## Architecture

```text
Browser
   |
   v
React + TypeScript Frontend
   |
   | REST API
   v
FastAPI Backend
   |
   +--> Category / song catalog
   +--> Round generation
   +--> Guess validation
   +--> Scoring
   |
   +------> PostgreSQL   (deployment foundation)
   |
   +------> Redis        (deployment foundation)

Licensed preview source
   |
   v
Browser audio playback
```

PostgreSQL and Redis are already wired into the Docker development stack, while the current MVP catalog still uses seeded application data. Moving the song catalog into PostgreSQL is part of the next phase.

## Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| UI icons | Lucide React |
| Backend | Python, FastAPI, Pydantic |
| API server | Uvicorn |
| Database foundation | PostgreSQL 16 |
| Cache/service foundation | Redis 7 |
| Local orchestration | Docker Compose |
| Deployment edge | Nginx |
| Backend testing | pytest, HTTPX |

## Game API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Backend health check |
| `GET` | `/api/categories` | List available categories |
| `GET` | `/api/search?q=<query>&category=<slug>` | Search the song catalog |
| `GET` | `/api/game/round?category=<slug>` | Start a category-filtered round |
| `POST` | `/api/game/guess` | Submit a guess and calculate points |
| `GET` | `/api/game/answer/{song_id}` | Reveal the answer |

A round response tells the frontend which reveal stages are available and whether that song currently has a real audio preview.

Example reveal stages:

```json
{
  "reveal_stages_seconds": [0.1, 0.5, 2.0, 5.0, 8.0]
}
```

## Scoring

The earlier the player identifies the song, the higher the score:

| Reveal used | Points |
| ---: | ---: |
| 0.1 seconds | 100 |
| 0.5 seconds | 80 |
| 2 seconds | 60 |
| 5 seconds | 40 |
| 8 seconds | 20 |

An incorrect guess awards zero points for that attempt.

## Audio & Licensing

The application deliberately keeps audio licensing separate from the game logic.

Each song record can provide a `preview_url`. In production, that URL must point to audio that SongSpot is legally allowed to serve or play.

Until licensed previews are connected, songs without a preview URL use a generated fallback tone during development. This allows the UI, API, scoring, and round flow to be built and tested without committing copyrighted commercial recordings to GitHub.

## Local Development

### Backend

```bash
cd backend
python -m venv .venv
```

Activate the environment, then:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API runs at:

```text
http://localhost:8000
```

Interactive FastAPI documentation is available at:

```text
http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The development frontend runs at:

```text
http://localhost:5173
```

## Docker Development Stack

The repository includes a Compose stack containing:

```text
frontend
backend API
PostgreSQL 16
Redis 7
```

Start it with:

```bash
docker compose up --build
```

Default development ports:

| Service | Port |
| --- | ---: |
| Frontend | 5173 |
| FastAPI | 8000 |
| PostgreSQL | 5432 |
| Redis | 6379 |

## Repository Structure

```text
.
├── frontend/             React + TypeScript game UI
├── backend/              FastAPI API and game logic
├── deploy/               deployment configuration
├── docker-compose.yml    local multi-service stack
├── .env.example          environment configuration example
└── README.md
```

## Product Direction

The MVP intentionally focuses on proving the core game before adding social/product features.

### Current phase

```text
Category -> Round -> Preview -> Guess -> Score -> Next Round
```

### Next phase

- persist songs and categories in PostgreSQL
- build an admin import workflow for licensed preview URLs
- connect legally permitted Indian-song previews
- add daily challenges
- add streaks
- add leaderboards
- add shareable results
- improve category coverage across Indian music styles and languages

## Engineering Decisions

### Progressive reveal instead of a fixed clip

Giving players increasingly longer previews creates a natural difficulty curve while letting one scoring system reward faster recognition.

### Backend-controlled scoring

Reveal stages and stage points live in the API model rather than only in frontend state. This keeps the scoring contract centralized as the frontend evolves.

### Audio metadata separated from copyrighted media

Song metadata and game logic can live publicly in GitHub while commercial recordings remain outside the repository. This avoids treating development convenience as permission to redistribute music.

### Infrastructure before persistence migration

PostgreSQL and Redis are included in the deployment foundation even though the first playable catalog is seeded in application code. This keeps the MVP simple while leaving a clear path to persistent catalog and game-state features.

## Current Limitations

- catalog data is still seeded rather than PostgreSQL-backed
- licensed preview ingestion is not implemented yet
- Redis is part of the infrastructure foundation but is not yet central to the current game loop
- leaderboard, accounts, daily challenge, and streak features are future work
- the project is an MVP and not yet a production music service

## Interview Summary

> I built the MVP foundation for an Indian song-guessing game using React/TypeScript and FastAPI. The backend controls category-based rounds, five progressive preview stages, guess validation, and score calculation, while Docker Compose provides PostgreSQL and Redis infrastructure for the next persistence phase. I also kept commercial audio outside the repository and designed the catalog around licensed preview URLs so the application logic can be developed without redistributing copyrighted recordings.
