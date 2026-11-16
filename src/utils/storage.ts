import { DifficultyLevel, GameBestRecord, GameModeId, SavedScenario } from '../types/graph';

const KEYS = {
  SETTINGS: 'routeverse:settings:v1',
  SCENARIOS: 'routeverse:scenarios:v1',
  GAME_SCORES: 'routeverse:scores:v1',
} as const;

export interface AppSettings {
  playbackSpeed: number;
  timerEnabled: boolean;
  showGridCoordinates: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  playbackSpeed: 1,
  timerEnabled: true,
  showGridCoordinates: true,
};

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors in restricted/incognito sessions
  }
}

export function loadSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS, ...safeRead<Partial<AppSettings>>(KEYS.SETTINGS, {}) };
}

export function saveSettings(settings: AppSettings): void {
  safeWrite(KEYS.SETTINGS, settings);
}

export function loadSavedScenarios(): SavedScenario[] {
  return safeRead<SavedScenario[]>(KEYS.SCENARIOS, []);
}

export function saveScenario(scenario: SavedScenario): SavedScenario[] {
  const existing = loadSavedScenarios().filter((s) => s.id !== scenario.id);
  const next = [scenario, ...existing].slice(0, 12);
  safeWrite(KEYS.SCENARIOS, next);
  return next;
}

export function deleteScenario(id: string): SavedScenario[] {
  const next = loadSavedScenarios().filter((s) => s.id !== id);
  safeWrite(KEYS.SCENARIOS, next);
  return next;
}

export type GameScoreMap = Record<string, GameBestRecord>;

export function makeScoreKey(game: GameModeId, difficulty: DifficultyLevel): string {
  return `${game}:${difficulty}`;
}

export function loadGameScores(): GameScoreMap {
  return safeRead<GameScoreMap>(KEYS.GAME_SCORES, {});
}

export function saveGameScoreIfBest(
  game: GameModeId,
  difficulty: DifficultyLevel,
  score: number,
  details: string
): { scores: GameScoreMap; isNewBest: boolean } {
  const all = loadGameScores();
  const key = makeScoreKey(game, difficulty);
  const prev = all[key];
  if (!prev || score > prev.score) {
    all[key] = {
      score,
      achievedAt: new Date().toISOString(),
      details,
    };
    safeWrite(KEYS.GAME_SCORES, all);
    return { scores: all, isNewBest: true };
  }
  return { scores: all, isNewBest: false };
}

export function clearAllGameScores(): GameScoreMap {
  safeWrite(KEYS.GAME_SCORES, {});
  return {};
}
