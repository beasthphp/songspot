import json
import random
import re
from functools import lru_cache
from pathlib import Path

from app.models import Category, Song, SongAnswer, SongSearchResult


DATA_DIR = Path(__file__).resolve().parent / "data"
SONGS_PATH = DATA_DIR / "songs.json"


CATEGORIES = [
    Category(
        slug="bollywood",
        name="Bollywood",
        description="Hindi film songs across eras and moods.",
    ),
    Category(
        slug="hindi-pop",
        name="Hindi Pop",
        description="Non-film Hindi pop and independent chart hits.",
    ),
    Category(
        slug="hindi-rap-hip-hop",
        name="Hindi Rap / Hip-Hop",
        description="Indian rap, hip-hop, and street-led tracks.",
    ),
    Category(
        slug="punjabi",
        name="Punjabi",
        description="Punjabi pop, film, and dance favorites.",
    ),
    Category(
        slug="classical",
        name="Classical",
        description="Indian classical and semi-classical selections.",
    ),
    Category(
        slug="indie",
        name="Indie",
        description="Independent Indian artists and bands.",
    ),
    Category(
        slug="rock",
        name="Rock",
        description="Indian rock, fusion rock, and band-led songs.",
    ),
    Category(
        slug="party-dance",
        name="Party / Dance",
        description="High-energy songs for celebrations and clubs.",
    ),
    Category(
        slug="romantic",
        name="Romantic",
        description="Love songs from film and independent catalogs.",
    ),
    Category(
        slug="regional-indian",
        name="Regional Indian",
        description="Songs from Indian languages beyond Hindi and Punjabi.",
    ),
    Category(
        slug="90s",
        name="90s",
        description="Indian songs released from 1990 to 1999.",
    ),
    Category(
        slug="2000s",
        name="2000s",
        description="Indian songs released from 2000 to 2009.",
    ),
    Category(
        slug="2010s",
        name="2010s",
        description="Indian songs released from 2010 to 2019.",
    ),
    Category(
        slug="2020s",
        name="2020s",
        description="Indian songs released from 2020 onward.",
    ),
    Category(
        slug="all-indian-songs",
        name="All Indian Songs",
        description="A mixed challenge across all available Indian songs.",
    ),
]


_rng = random.SystemRandom()


def normalize_guess(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


@lru_cache(maxsize=1)
def get_categories() -> list[Category]:
    return CATEGORIES


@lru_cache(maxsize=1)
def get_songs() -> list[Song]:
    with SONGS_PATH.open("r", encoding="utf-8") as songs_file:
        payload = json.load(songs_file)
    return [Song.model_validate(item) for item in payload]


def get_category(slug: str) -> Category | None:
    return next((category for category in get_categories() if category.slug == slug), None)


def songs_for_category(category_slug: str) -> list[Song]:
    if category_slug == "all-indian-songs":
        return get_songs()
    return [
        song
        for song in get_songs()
        if category_slug in song.category_slugs
    ]


def choose_song(category_slug: str) -> Song | None:
    songs = songs_for_category(category_slug)
    if not songs:
        return None
    return _rng.choice(songs)


def find_song(song_id: str) -> Song | None:
    return next((song for song in get_songs() if song.id == song_id), None)


def answer_for(song: Song) -> SongAnswer:
    return SongAnswer(id=song.id, title=song.title, artist=song.artist, year=song.year)


def is_correct_guess(song: Song, guess: str) -> bool:
    normalized_guess = normalize_guess(guess)
    accepted_answers = [song.title, *song.aliases]
    return normalized_guess in {normalize_guess(answer) for answer in accepted_answers}


def search_songs(query: str, category_slug: str | None = None, limit: int = 8) -> list[SongSearchResult]:
    normalized_query = normalize_guess(query)
    if not normalized_query:
        return []

    if category_slug:
        candidates = songs_for_category(category_slug)
    else:
        candidates = get_songs()

    matches: list[SongSearchResult] = []
    for song in candidates:
        searchable_values = [song.title, song.artist, *song.aliases, str(song.year)]
        if any(normalized_query in normalize_guess(value) for value in searchable_values):
            matches.append(
                SongSearchResult(
                    id=song.id,
                    title=song.title,
                    artist=song.artist,
                    year=song.year,
                )
            )

        if len(matches) >= limit:
            break

    return matches
