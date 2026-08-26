from pydantic import BaseModel, Field


REVEAL_STAGES_SECONDS = [0.1, 0.5, 2.0, 5.0, 8.0]
STAGE_POINTS = [100, 80, 60, 40, 20]


class Category(BaseModel):
    slug: str
    name: str
    description: str


class Song(BaseModel):
    id: str
    title: str
    artist: str
    year: int
    category_slugs: list[str]
    aliases: list[str] = Field(default_factory=list)
    preview_url: str | None = None
    fallback_tone_hz: int = 440


class SongSearchResult(BaseModel):
    id: str
    title: str
    artist: str
    year: int


class SongAnswer(BaseModel):
    id: str
    title: str
    artist: str
    year: int


class RoundResponse(BaseModel):
    song_id: str
    category: Category
    reveal_stages_seconds: list[float]
    preview_url: str | None = None
    fallback_tone_hz: int
    has_audio_preview: bool


class GuessRequest(BaseModel):
    song_id: str
    guess: str = Field(min_length=1, max_length=160)
    reveal_stage_index: int = Field(ge=0, le=4)


class GuessResponse(BaseModel):
    correct: bool
    points_awarded: int
    answer: SongAnswer | None = None
