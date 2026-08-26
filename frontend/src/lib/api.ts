import type {
  Category,
  GuessResponse,
  Round,
  SongAnswer,
  SongSearchResult
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers
    },
    ...options
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function fetchCategories(): Promise<Category[]> {
  return request<Category[]>("/api/categories");
}

export function fetchRound(category: string): Promise<Round> {
  return request<Round>(`/api/game/round?category=${encodeURIComponent(category)}`);
}

export function searchSongs(query: string, category: string): Promise<SongSearchResult[]> {
  const params = new URLSearchParams({ q: query, category });
  return request<SongSearchResult[]>(`/api/search?${params.toString()}`);
}

export function submitGuess(
  songId: string,
  guess: string,
  revealStageIndex: number
): Promise<GuessResponse> {
  return request<GuessResponse>("/api/game/guess", {
    method: "POST",
    body: JSON.stringify({
      song_id: songId,
      guess,
      reveal_stage_index: revealStageIndex
    })
  });
}

export function fetchAnswer(songId: string): Promise<SongAnswer> {
  return request<SongAnswer>(`/api/game/answer/${encodeURIComponent(songId)}`);
}
