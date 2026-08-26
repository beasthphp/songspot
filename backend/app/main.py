from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.catalog import (
    answer_for,
    choose_song,
    find_song,
    get_categories,
    get_category,
    is_correct_guess,
    search_songs,
)
from app.models import (
    GuessRequest,
    GuessResponse,
    REVEAL_STAGES_SECONDS,
    RoundResponse,
    STAGE_POINTS,
    SongAnswer,
    SongSearchResult,
)
from app.settings import settings


app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/categories")
def categories():
    return get_categories()


@app.get("/api/search", response_model=list[SongSearchResult])
def search(
    q: str = Query(default="", min_length=0, max_length=80),
    category: str | None = Query(default=None),
):
    if category and not get_category(category):
        raise HTTPException(status_code=404, detail="Category not found")
    return search_songs(q, category_slug=category)


@app.get("/api/game/round", response_model=RoundResponse)
def game_round(category: str = Query(default="all-indian-songs")):
    selected_category = get_category(category)
    if not selected_category:
        raise HTTPException(status_code=404, detail="Category not found")

    song = choose_song(category)
    if not song:
        raise HTTPException(status_code=404, detail="No songs available for category")

    return RoundResponse(
        song_id=song.id,
        category=selected_category,
        reveal_stages_seconds=REVEAL_STAGES_SECONDS,
        preview_url=song.preview_url,
        fallback_tone_hz=song.fallback_tone_hz,
        has_audio_preview=bool(song.preview_url),
    )


@app.post("/api/game/guess", response_model=GuessResponse)
def guess(payload: GuessRequest):
    song = find_song(payload.song_id)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    correct = is_correct_guess(song, payload.guess)
    points = STAGE_POINTS[payload.reveal_stage_index] if correct else 0

    return GuessResponse(
        correct=correct,
        points_awarded=points,
        answer=answer_for(song) if correct else None,
    )


@app.get("/api/game/answer/{song_id}", response_model=SongAnswer)
def answer(song_id: str):
    song = find_song(song_id)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    return answer_for(song)
