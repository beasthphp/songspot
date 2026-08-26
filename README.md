# SongSpot.in

SongSpot.in is an Indian-focused song guessing game. Players choose a category, choose a preview length, and try to identify the track.

Preview length choices:

```text
0.1s -> 0.5s -> 2s -> 5s -> 8s
```

## MVP Scope

The first version focuses on the core loop:

```text
Open SongSpot.in -> choose category -> choose clip length -> play preview -> guess or reveal answer -> score -> next song
```

This repository currently includes:

- React + Vite frontend
- FastAPI backend
- Seeded Indian music metadata
- Category, search, round, guess, and answer API endpoints
- Docker Compose for frontend, backend, PostgreSQL, and Redis
- Nginx reverse proxy example for VPS deployment

## Audio Licensing

Commercial Indian recordings are not bundled in this repository.

The app supports `preview_url` per song, but those URLs must point to licensed audio previews or another legally permitted source before production launch. Until then, the frontend uses a short generated tone as a development placeholder whenever a song has no preview URL.

## Local Development

Backend:

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Docker:

```bash
docker compose up --build
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

## API

- `GET /health`
- `GET /api/categories`
- `GET /api/search?q=<query>&category=<slug>`
- `GET /api/game/round?category=<slug>`
- `POST /api/game/guess`
- `GET /api/game/answer/{song_id}`

## Next Work

- Replace seeded metadata with a PostgreSQL-backed song table
- Add an admin import workflow for licensed preview URLs
- Add daily challenge, streaks, leaderboard, and share results after the basic loop is stable
