import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Eye,
  Headphones,
  Loader2,
  Music2,
  Play,
  RotateCcw,
  Search
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

const DEFAULT_CATEGORY = "all-indian-songs";
const DEFAULT_REVEAL_STAGES = [0.1, 0.5, 2, 5, 8];
const STAGE_POINTS = [100, 80, 60, 40, 20];

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
  const [message, setMessage] = useState("Choose a category, start a song, then pick any clip length.");
  const [isPlaying, setIsPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioTimerRef = useRef<number | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const currentCategory = useMemo(
    () => categories.find((category) => category.slug === selectedCategory),
    [categories, selectedCategory]
  );

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

  async function startRound() {
    stopAudio();
    setRoundState("loading");
    setMessage("Loading the next song.");
    setGuess("");
    setSuggestions([]);
    setAnswer(null);
    setStageIndex(0);

    try {
      const nextRound = await fetchRound(selectedCategory);
      setRound(nextRound);
      setRoundState("ready");
      setMessage(
        nextRound.has_audio_preview
          ? "Pick any clip length and press play."
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

  return (
    <main className="app-shell">
      <section className="masthead" aria-labelledby="app-title">
        <div>
          <p className="eyebrow">Indian music guessing game</p>
          <h1 id="app-title">SongSpot.in</h1>
        </div>
        <div className="score" aria-label={`Current score ${score}`}>
          <span>Score</span>
          <strong>{score}</strong>
        </div>
      </section>

      <section className="category-section" aria-labelledby="category-heading">
        <div className="section-heading">
          <h2 id="category-heading">Category</h2>
          <span>{currentCategory?.name ?? "Select one"}</span>
        </div>
        <div className="category-grid">
          {categories.map((category) => (
            <button
              className="category-button"
              type="button"
              key={category.slug}
              aria-pressed={selectedCategory === category.slug}
              onClick={() => setSelectedCategory(category.slug)}
            >
              <span>{category.name}</span>
              {selectedCategory === category.slug && <small>Selected</small>}
            </button>
          ))}
        </div>
      </section>

      <section className="game-surface" aria-labelledby="game-heading">
        <div className="game-header">
          <div>
            <p className="eyebrow">{currentCategory?.name ?? "Category"}</p>
            <h2 id="game-heading">Guess The Song</h2>
          </div>
          <button className="secondary-button" type="button" onClick={startRound}>
            {roundState === "loading" ? (
              <Loader2 aria-hidden="true" className="spin" />
            ) : (
              <RotateCcw aria-hidden="true" />
            )}
            {round ? "New Song" : "Start"}
          </button>
        </div>

        <div className="player-row">
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
            <span>Clip length</span>
            <strong>{formatDuration(currentDuration)}</strong>
            <small>{currentPoints} points if correct</small>
          </div>
          <div className="status-message" role="status" aria-live="polite">
            {message}
          </div>
        </div>

        <fieldset className="duration-picker" disabled={!round || isRoundFinished}>
          <legend>Choose Preview Length</legend>
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
          <label htmlFor="song-search">
            <Search aria-hidden="true" />
            Song search
          </label>
          <div className="search-wrap">
            <input
              id="song-search"
              type="search"
              value={guess}
              autoComplete="off"
              placeholder="Type a song title"
              disabled={!canGuess}
              aria-describedby="guess-help"
              onChange={(event) => setGuess(event.target.value)}
            />
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

        {answer && (
          <div className="answer-panel">
            <span>{roundState === "correct" ? "You got it" : "Answer"}</span>
            <strong>{answer.title}</strong>
            <small>
              {answer.artist} - {answer.year}
            </small>
            <button className="primary-button" type="button" onClick={startRound}>
              <RotateCcw aria-hidden="true" />
              Next Song
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
