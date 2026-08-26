export type Category = {
  slug: string;
  name: string;
  description: string;
};

export type Round = {
  song_id: string;
  category: Category;
  reveal_stages_seconds: number[];
  preview_url: string | null;
  fallback_tone_hz: number;
  has_audio_preview: boolean;
};

export type SongSearchResult = {
  id: string;
  title: string;
  artist: string;
  year: number;
};

export type SongAnswer = {
  id: string;
  title: string;
  artist: string;
  year: number;
};

export type GuessResponse = {
  correct: boolean;
  points_awarded: number;
  answer: SongAnswer | null;
};
