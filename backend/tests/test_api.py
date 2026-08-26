from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_categories_include_all_indian_songs():
    response = client.get("/api/categories")

    assert response.status_code == 200
    slugs = {category["slug"] for category in response.json()}
    assert "all-indian-songs" in slugs


def test_round_returns_reveal_stages():
    response = client.get("/api/game/round?category=bollywood")

    assert response.status_code == 200
    payload = response.json()
    assert payload["category"]["slug"] == "bollywood"
    assert payload["reveal_stages_seconds"] == [0.1, 0.5, 2.0, 5.0, 8.0]
    assert payload["song_id"]


def test_search_returns_song_metadata():
    response = client.get("/api/search?q=kesariya&category=all-indian-songs")

    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["title"] == "Kesariya"


def test_correct_guess_scores_by_reveal_stage():
    response = client.post(
        "/api/game/guess",
        json={
            "song_id": "tum-hi-ho",
            "guess": "Tum Hi Ho",
            "reveal_stage_index": 2,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["correct"] is True
    assert payload["points_awarded"] == 60
    assert payload["answer"]["title"] == "Tum Hi Ho"


def test_incorrect_guess_returns_no_answer():
    response = client.post(
        "/api/game/guess",
        json={
            "song_id": "tum-hi-ho",
            "guess": "Wrong Song",
            "reveal_stage_index": 0,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["correct"] is False
    assert payload["points_awarded"] == 0
    assert payload["answer"] is None
