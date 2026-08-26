import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Eye,
  Headphones,
  Loader2,
  Music2,
  Play,
  RotateCcw,
  Search,
  Star
} from "lucide-react";
import {
  fetchAnswer,
  fetchCategories,
  fetchRound,
  searchSongs,
  submitGuess
} from "./lib/api";
import type { Category, Round, SongAnswer, SongSearchResult } from "./types";

type RoundState = "idle" | "loading" | "ready" | "correct" | "revealed" | "error";
type BrowserAudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };
type CategoryShortcut = {
  slug: string;
  label: string;
};
type DifficultyOption = {
  id: "easy" | "medium" | "hard";
  label: string;
  stars: number;
  stageIndex: number;
};

const DEFAULT_CATEGORY = "all-indian-songs";
const DEFAULT_REVEAL_STAGES = [0.1, 0.5, 2, 5, 8];
const STAGE_POINTS = [100, 80, 60, 40, 20];
const GENRE_SHORTCUTS: CategoryShortcut[] = [
  { slug: "bollywood", label: "Bollywood" },
  { slug: "classical", label: "Classical" },
  { slug: "indie", label: "Indie" },
  { slug: "90s", label: "Retro" }
];
const YEAR_SHORTCUTS: CategoryShortcut[] = [
  { slug: "2020s", label: "2020s" },
  { slug: "2010s", label: "2010s" },
  { slug: "2000s", label: "2000s" },
  { slug: "all-indian-songs", label: "All" }
];
const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  { id: "easy", label: "Easy", stars: 1, stageIndex: 3 },
  { id: "medium", label: "Medium", stars: 2, stageIndex: 1 },
  { id: "hard", label: "Hard", stars: 3, stageIndex: 0 }
];

function formatDuration(seconds: number) {
  return `${seconds.toFixed(seconds < 1 ? 1 : 0)}s`;
}

function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_CATEGORY);
  const [round, setRound] = useState<Round | null>(null);
  const [roundState, setRoundState] = useState<RoundState>("idle");
  const [stageIndex, setStageIndex] = useState(0);
  const [guess, setGuess] = useState("");
  const [suggestions, setSuggestions] = useState<SongSearchResult[]>([]);
  const [answer, setAnswer] = useState<SongAnswer | null>(null);
  const [score, setScore] = useState(0);
  const [difficulty, setDifficulty] = useState<DifficultyOption["id"]>("hard");
  const [message, setMessage] = useState("Choose a category and start a song.");
  const [isPlaying, setIsPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioTimerRef = useRef<number | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const currentCategory = useMemo(
    () => categories.find((category) => category.slug === selectedCategory),
    [categories, selectedCategory]
  );
  const currentDifficulty =
    DIFFICULTY_OPTIONS.find((option) => option.id === difficulty) ?? DIFFICULTY_OPTIONS[2];

  const revealStages = round?.reveal_stages_seconds ?? DEFAULT_REVEAL_STAGES;
  const currentDuration = revealStages[stageIndex] ?? revealStages[0];
  const currentPoints = STAGE_POINTS[stageIndex] ?? STAGE_POINTS[STAGE_POINTS.length - 1];
  const canGuess = roundState === "ready" && Boolean(round);
  const isRoundFinished = roundState === "correct" || roundState === "revealed";

  useEffect(() => {
    fetchCategories()
      .then((items) => {
        setCategories(items);
        if (!items.some((category) => category.slug === DEFAULT_CATEGORY)) {
          setSelectedCategory(items[0]?.slug ?? DEFAULT_CATEGORY);
        }
      })
      .catch(() => {
        setRoundState("error");
        setMessage("The category list could not load.");
      });
  }, []);

  useEffect(() => {
    if (!guess.trim() || !round || !canGuess) {
      setSuggestions([]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      searchSongs(guess, selectedCategory)
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [canGuess, guess, round, selectedCategory]);

  function stopAudio() {
    if (audioTimerRef.current) {
      window.clearTimeout(audioTimerRef.current);
      audioTimerRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
      oscillatorRef.current.disconnect();
      oscillatorRef.current = null;
    }

    setIsPlaying(false);
  }

  function chooseCategory(slug: string) {
    stopAudio();
    setSelectedCategory(slug);
    setRound(null);
    setRoundState("idle");
    setGuess("");
    setSuggestions([]);
    setAnswer(null);
    setStageIndex(currentDifficulty.stageIndex);
    setMessage("Category selected. Start a song.");
  }

  async function startRound() {
    stopAudio();
    setRoundState("loading");
    setMessage("Loading the next song.");
    setGuess("");
    setSuggestions([]);
    setAnswer(null);
    setStageIndex(currentDifficulty.stageIndex);

    try {
      const nextRound = await fetchRound(selectedCategory);
      setRound(nextRound);
      setRoundState("ready");
      setMessage(
        nextRound.has_audio_preview
          ? "Pick a clip length and press play."
          : "Licensed preview pending. Development tone is ready."
      );
    } catch {
      setRoundState("error");
      setMessage("A new song could not be loaded.");
    }
  }

  function selectDuration(index: number) {
    if (!round || isRoundFinished) {
      return;
    }

    stopAudio();
    setStageIndex(index);
    setMessage(`${formatDuration(revealStages[index])} clip selected.`);
  }

  function selectDifficulty(option: DifficultyOption) {
    stopAudio();
    setDifficulty(option.id);

    if (round && !isRoundFinished) {
      setStageIndex(option.stageIndex);
    }
  }

  function playGeneratedTone(duration: number, frequency: number) {
    const AudioContextClass =
      window.AudioContext || (window as BrowserAudioWindow).webkitAudioContext;

    if (!AudioContextClass) {
      setIsPlaying(false);
      setMessage("Audio playback is not available in this browser.");
      return;
    }

    const context = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = context;

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
    oscillatorRef.current = oscillator;

    oscillator.onended = () => setIsPlaying(false);
  }

  async function playPreview() {
    if (!round || isPlaying || isRoundFinished) {
      return;
    }

    stopAudio();
    setIsPlaying(true);

    if (round.preview_url) {
      const audio = audioRef.current ?? new Audio(round.preview_url);
      audio.src = round.preview_url;
      audio.currentTime = 0;
      audioRef.current = audio;

      try {
        await audio.play();
        audioTimerRef.current = window.setTimeout(stopAudio, currentDuration * 1000);
      } catch {
        stopAudio();
        setMessage("Audio playback was blocked by the browser.");
      }
      return;
    }

    playGeneratedTone(currentDuration, round.fallback_tone_hz);
  }

  async function handleGuess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!round || !guess.trim()) {
      return;
    }

    try {
      const result = await submitGuess(round.song_id, guess, stageIndex);
      if (result.correct && result.answer) {
        stopAudio();
        setAnswer(result.answer);
        setScore((currentScore) => currentScore + result.points_awarded);
        setRoundState("correct");
        setSuggestions([]);
        setMessage(`Correct. +${result.points_awarded} points.`);
        return;
      }

      setMessage("Not quite. Try again, or choose a longer clip.");
    } catch {
      setMessage("The guess could not be checked.");
    }
  }

  async function showAnswer() {
    if (!round) {
      return;
    }

    stopAudio();

    try {
      const revealedAnswer = await fetchAnswer(round.song_id);
      setAnswer(revealedAnswer);
      setRoundState("revealed");
      setSuggestions([]);
      setMessage("Answer revealed.");
    } catch {
      setMessage("The answer could not be revealed.");
    }
  }

  function pickSuggestion(song: SongSearchResult) {
    setGuess(song.title);
    setSuggestions([]);
  }

  function renderCategoryButton(shortcut: CategoryShortcut) {
    const category = categories.find((item) => item.slug === shortcut.slug);

    if (!category) {
      return null;
    }

    return (
      <button
        className="filter-button"
        type="button"
        key={shortcut.slug}
        aria-pressed={selectedCategory === shortcut.slug}
        aria-label={`Choose ${category.name} category`}
        onClick={() => chooseCategory(shortcut.slug)}
      >
        {shortcut.label}
      </button>
    );
  }

  return (
    <main className="app-shell">
      <div className="film-strip film-strip-left" aria-hidden="true" />
      <div className="film-strip film-strip-right" aria-hidden="true" />

      <header className="topbar" aria-labelledby="app-title">
        <div className="brand-lockup">
          <p className="eyebrow">Indian Music Guessing Game</p>
          <h1 id="app-title">SongSpot.in</h1>
        </div>

        <div className="score-pill" aria-label={`Current score ${score}`}>
          <span>Score</span>
          <strong>{score}</strong>
          {Array.from({ length: currentDifficulty.stars }).map((_, index) => (
            <Star aria-hidden="true" fill="currentColor" key={index} />
          ))}
        </div>
      </header>

      <div className="game-layout">
        <aside className="filters-card" aria-labelledby="filters-heading">
          <h2 id="filters-heading">Genre</h2>
          <div className="accent-line" aria-hidden="true" />
          <div className="filter-stack">{GENRE_SHORTCUTS.map(renderCategoryButton)}</div>

          <div className="filter-divider" aria-hidden="true" />

          <h2>Year</h2>
          <div className="accent-line" aria-hidden="true" />
          <div className="filter-stack">{YEAR_SHORTCUTS.map(renderCategoryButton)}</div>

          <h2 className="difficulty-heading">Difficulty</h2>
          <div className="accent-line" aria-hidden="true" />
          <div className="difficulty-row" aria-label="Difficulty">
            {DIFFICULTY_OPTIONS.map((option) => (
              <button
                className="difficulty-button"
                type="button"
                key={option.id}
                aria-pressed={difficulty === option.id}
                aria-label={`Choose ${option.label} difficulty`}
                onClick={() => selectDifficulty(option)}
              >
                {Array.from({ length: option.stars }).map((_, index) => (
                  <Star aria-hidden="true" fill="currentColor" key={index} />
                ))}
              </button>
            ))}
          </div>
        </aside>

        <section className="game-card" aria-labelledby="game-heading">
          <div className="game-category-bar">
            <div className="category-label">
              <Music2 aria-hidden="true" />
              <span>{currentCategory?.name ?? "Category"}</span>
            </div>
            <button className="new-song-button" type="button" onClick={startRound}>
              {roundState === "loading" ? (
                <Loader2 aria-hidden="true" className="spin" />
              ) : (
                <RotateCcw aria-hidden="true" />
              )}
              {round ? "New Song" : "Start Game"}
            </button>
          </div>

          <div className="game-center">
            <h2 id="game-heading">Guess The Song</h2>
            <div className="title-line" aria-hidden="true" />

            <button
              className="play-button"
              type="button"
              aria-label={`Play ${formatDuration(currentDuration)} preview`}
              disabled={!round || roundState === "loading" || isRoundFinished}
              onClick={playPreview}
            >
              {isPlaying ? <Headphones aria-hidden="true" /> : <Play aria-hidden="true" />}
            </button>

            <div className="duration-readout">
              <strong>{formatDuration(currentDuration)}</strong>
              <span>clip length</span>
              <small>{currentPoints} points if correct</small>
            </div>
            <div className="sr-only" role="status" aria-live="polite">{message}</div>
          </div>

          {!answer && (
            <>
              <fieldset className="duration-picker" disabled={!round || isRoundFinished}>
                <legend>Clip Length</legend>
                <div className="duration-options">
                  {revealStages.map((seconds, index) => (
                    <button
                      className="duration-option"
                      type="button"
                      key={seconds}
                      aria-pressed={index === stageIndex}
                      onClick={() => selectDuration(index)}
                    >
                      <span>{formatDuration(seconds)}</span>
                      <small>{STAGE_POINTS[index]} pts</small>
                    </button>
                  ))}
                </div>
              </fieldset>

              <form className="guess-form" onSubmit={handleGuess}>
                <label htmlFor="song-search" className="sr-only">
                  Song search
                </label>
                <div className="search-wrap">
                  <input
                    id="song-search"
                    type="search"
                    value={guess}
                    autoComplete="off"
                    placeholder="Type your guess (song name or lyrics...)"
                    disabled={!canGuess}
                    aria-describedby="guess-help"
                    onChange={(event) => setGuess(event.target.value)}
                  />
                  <Search aria-hidden="true" className="search-icon" />
                  {suggestions.length > 0 && (
                    <ul className="suggestions" role="listbox" aria-label="Song suggestions">
                      {suggestions.map((song) => (
                        <li key={song.id}>
                          <button type="button" onClick={() => pickSuggestion(song)}>
                            <Music2 aria-hidden="true" />
                            <span>
                              {song.title}
                              <small>
                                {song.artist} - {song.year}
                              </small>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p id="guess-help" className="sr-only">
                  Type a song name, choose a suggestion, then submit your guess.
                </p>
                <div className="action-row">
                  <button className="primary-button" type="submit" disabled={!canGuess || !guess.trim()}>
                    <Check aria-hidden="true" />
                    Guess
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={!round || roundState === "loading" || isRoundFinished}
                    onClick={showAnswer}
                  >
                    <Eye aria-hidden="true" />
                    Show Answer
                  </button>
                </div>
              </form>
            </>
          )}

          {answer && (
            <div className="answer-panel">
              <span>{roundState === "correct" ? "You got it" : "Answer"}</span>
              <strong>{answer.title}</strong>
              <small>
                {answer.artist} - {answer.year}
              </small>
              <button
                className="primary-button"
                type="button"
                onClick={startRound}
              >
                <RotateCcw aria-hidden="true" />
                Next Song
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default App;
