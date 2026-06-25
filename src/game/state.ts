import type { Food, FoodId, GameState, Rank } from './types'

export const CONFIG = {
  gameDuration: 180,
  maxCustomers: 5,
  patienceDrainPerSecond: 14,
  serveCost: 20,
  refillAmount: 40,
  refillCooldown: 0.8,
  cookTime: 0.6,
  spawnStart: 1.8,
  spawnEnd: 0.7,
  lostPenalty: 150,
  baseServeScore: 100,
  maxComboMultiplier: 3,
  patienceBonusMax: 50,
  lowStockThreshold: 25,
  highScoreKey: 'panicbuffet.highscore',
} as const

export const FOOD_ORDER: FoodId[] = ['pizza', 'pasta', 'drink']

export const CUSTOMER_EMOJIS = ['😀', '🙂', '😄', '🤤', '😋', '😊'] as const

const FOOD_DEFS: Record<FoodId, Pick<Food, 'id' | 'emoji' | 'label' | 'key'>> = {
  pizza: { id: 'pizza', emoji: '🍕', label: 'Pizza', key: '1' },
  pasta: { id: 'pasta', emoji: '🍝', label: 'Pasta', key: '2' },
  drink: { id: 'drink', emoji: '🥤', label: 'Drink', key: '3' },
}

export function readHighScore(): number {
  try {
    const value = Number.parseInt(localStorage.getItem(CONFIG.highScoreKey) ?? '0', 10)
    return Number.isFinite(value) && value > 0 ? value : 0
  } catch {
    return 0
  }
}

export function writeHighScore(score: number): void {
  try {
    localStorage.setItem(CONFIG.highScoreKey, String(Math.max(0, Math.floor(score))))
  } catch {
    // Storage can be unavailable in private browsing; the game still runs.
  }
}

export function getRank(score: number): Rank {
  if (score >= 6000) return 'S'
  if (score >= 4000) return 'A'
  if (score >= 2500) return 'B'
  if (score >= 1200) return 'C'
  return 'D'
}

export function createInitialState(scene: GameState['scene'] = 'title'): GameState {
  return {
    scene,
    foods: createFoods(),
    customers: [],
    departing: [],
    floatingTexts: [],
    elapsed: 0,
    timeRemaining: CONFIG.gameDuration,
    spawnTimer: 0.85,
    autoServeTimer: 0,
    score: 0,
    highScore: readHighScore(),
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

function createFoods(): Record<FoodId, Food> {
  return FOOD_ORDER.reduce((foods, id) => {
    foods[id] = {
      ...FOOD_DEFS[id],
      stock: 100,
      displayStock: 100,
      cooldown: 0,
      pressPulse: 0,
    }
    return foods
  }, {} as Record<FoodId, Food>)
}
