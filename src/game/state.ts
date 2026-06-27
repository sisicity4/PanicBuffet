import type { Difficulty, Food, FoodId, GameState, Rank, Tuning } from './types'

/** Invariants shared by every difficulty. The per-run knobs live in TUNINGS. */
export const CONFIG = {
  gameDuration: 180,
  maxCustomers: 5,
  baseServeScore: 100,
  comboStep: 0.1,
  maxComboMultiplier: 3,
  patienceBonusMax: 50,
  lowStockThreshold: 30,
  highScoreKeyPrefix: 'panicbuffet.highscore',
} as const

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'normal', 'hard']

export const TUNINGS: Record<Difficulty, Tuning> = {
  easy: {
    label: 'Easy',
    emoji: '🍵',
    blurb: 'ゆったり練習。たっぷり在庫＆のんびりしたお客。',
    patienceDrainPerSecond: 12,
    patienceDrainRamp: 0.3,
    startStock: 100,
    nibblePerSecond: 0,
    serveCost: 20,
    refillAmount: 45,
    refillCooldown: 0.7,
    cookTime: 0.65,
    spawnStart: 2,
    spawnEnd: 0.9,
    lostPenalty: 100,
    sharedKitchen: false,
    rankThresholds: { S: 38000, A: 28000, B: 18000, C: 9000 },
  },
  normal: {
    label: 'Normal',
    emoji: '🍙',
    blurb: '本番のランチ営業。3ラインを切らさず回そう。',
    patienceDrainPerSecond: 16,
    patienceDrainRamp: 0.5,
    startStock: 80,
    nibblePerSecond: 3,
    serveCost: 22,
    refillAmount: 34,
    refillCooldown: 0.8,
    cookTime: 0.58,
    spawnStart: 1.6,
    spawnEnd: 0.65,
    lostPenalty: 150,
    sharedKitchen: false,
    rankThresholds: { S: 46000, A: 33000, B: 21000, C: 10000 },
  },
  hard: {
    label: 'Hard',
    emoji: '🌶️',
    blurb: 'キッチンは一度に1品しか補充できない。優先順位がすべて。',
    patienceDrainPerSecond: 21,
    patienceDrainRamp: 0.7,
    startStock: 60,
    nibblePerSecond: 6,
    serveCost: 24,
    refillAmount: 34,
    refillCooldown: 0.62,
    cookTime: 0.52,
    spawnStart: 1.3,
    spawnEnd: 0.45,
    lostPenalty: 250,
    sharedKitchen: true,
    rankThresholds: { S: 44000, A: 31000, B: 19000, C: 9000 },
  },
}

const DEFAULT_DIFFICULTY: Difficulty = 'normal'

export const FOOD_ORDER: FoodId[] = ['pizza', 'pasta', 'drink']

export const CUSTOMER_EMOJIS = ['😀', '🙂', '😄', '🤤', '😋', '😊'] as const

const FOOD_DEFS: Record<FoodId, Pick<Food, 'id' | 'emoji' | 'label' | 'key'>> = {
  pizza: { id: 'pizza', emoji: '🍕', label: 'Pizza', key: '1' },
  pasta: { id: 'pasta', emoji: '🍝', label: 'Pasta', key: '2' },
  drink: { id: 'drink', emoji: '🥤', label: 'Drink', key: '3' },
}

function highScoreKey(difficulty: Difficulty): string {
  return `${CONFIG.highScoreKeyPrefix}.${difficulty}`
}

export function readHighScore(difficulty: Difficulty): number {
  try {
    const value = Number.parseInt(localStorage.getItem(highScoreKey(difficulty)) ?? '0', 10)
    return Number.isFinite(value) && value > 0 ? value : 0
  } catch {
    return 0
  }
}

export function writeHighScore(difficulty: Difficulty, score: number): void {
  try {
    localStorage.setItem(highScoreKey(difficulty), String(Math.max(0, Math.floor(score))))
  } catch {
    // Storage can be unavailable in private browsing; the game still runs.
  }
}

export function getRank(score: number, tuning: Tuning): Rank {
  const t = tuning.rankThresholds
  if (score >= t.S) return 'S'
  if (score >= t.A) return 'A'
  if (score >= t.B) return 'B'
  if (score >= t.C) return 'C'
  return 'D'
}

export function createInitialState(
  scene: GameState['scene'] = 'title',
  difficulty: Difficulty = DEFAULT_DIFFICULTY,
): GameState {
  const tuning = TUNINGS[difficulty]
  return {
    scene,
    difficulty,
    tuning,
    kitchenCooldown: 0,
    foods: createFoods(tuning.startStock),
    customers: [],
    departing: [],
    floatingTexts: [],
    elapsed: 0,
    timeRemaining: CONFIG.gameDuration,
    spawnTimer: 0.85,
    autoServeTimer: 0,
    score: 0,
    highScore: readHighScore(difficulty),
    combo: 0,
    comboPulse: 0,
    rank: 'D',
    newRecord: false,
    shakeTime: 0,
    flashTime: 0,
    backgroundTime: 0,
    nextCustomerId: 1,
    nextEffectId: 1,
  }
}

function createFoods(startStock: number): Record<FoodId, Food> {
  return FOOD_ORDER.reduce((foods, id) => {
    foods[id] = {
      ...FOOD_DEFS[id],
      stock: startStock,
      displayStock: startStock,
      cooldown: 0,
      pressPulse: 0,
    }
    return foods
  }, {} as Record<FoodId, Food>)
}
