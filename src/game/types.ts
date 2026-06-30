export type Scene = 'title' | 'playing' | 'result'

export type FoodId = 'pizza' | 'pasta' | 'drink'

export type Rank = 'S' | 'A' | 'B' | 'C' | 'D'

export type Difficulty = 'easy' | 'normal' | 'hard'

/** Difficulty-sensitive knobs. Invariants (duration, scoring) stay in CONFIG. */
export interface Tuning {
  label: string
  emoji: string
  blurb: string
  patienceDrainPerSecond: number
  patienceDrainRamp: number
  startStock: number
  /** Buffet self-service: each waiting guest nibbles this much of their food/sec. */
  nibblePerSecond: number
  serveCost: number
  refillAmount: number
  refillCooldown: number
  cookTime: number
  spawnStart: number
  spawnEnd: number
  lostPenalty: number
  /** Hard mode: one shared kitchen timer — only one station can restock at a time. */
  sharedKitchen: boolean
  rankThresholds: { S: number; A: number; B: number; C: number }
}

export interface Food {
  id: FoodId
  emoji: string
  label: string
  key: string
  stock: number
  displayStock: number
  cooldown: number
  pressPulse: number
}

export interface Customer {
  id: number
  food: FoodId
  patience: number
  mood: 'waiting' | 'served' | 'angry'
  x: number
  y: number
  targetX: number
  bobOffset: number
  exitTimer: number
  serveTimer: number
}

export interface FloatingText {
  id: number
  text: string
  x: number
  y: number
  vy: number
  age: number
  duration: number
  tone: 'good' | 'bad' | 'combo'
}

export interface DepartingCustomer {
  id: number
  x: number
  y: number
  age: number
  duration: number
}

export interface InputState {
  refillRequests: Partial<Record<FoodId, boolean>>
  startRequested: boolean
  restartRequested: boolean
  selectedDifficulty?: Difficulty
}

/** 1ゲーム分の内部カウンタ（実績計算に使う）。 */
export interface RunStats {
  served: number
  lost: number
  bestCombo: number
}

/** 実績トースト1件分のデータ。render.ts がキューを読んで表示する。 */
export interface AchievementToast {
  id: string
  emoji: string
  name: string
}

/** ローカルランキングの1エントリ（難易度別にトップ5を localStorage 保存）。 */
export interface LeaderboardEntry {
  score: number
  rank: Rank
  date: string
}

export interface GameState {
  scene: Scene
  difficulty: Difficulty
  tuning: Tuning
  kitchenCooldown: number
  foods: Record<FoodId, Food>
  customers: Customer[]
  departing: DepartingCustomer[]
  floatingTexts: FloatingText[]
  elapsed: number
  timeRemaining: number
  spawnTimer: number
  autoServeTimer: number
  score: number
  highScore: number
  combo: number
  comboPulse: number
  rank: Rank
  newRecord: boolean
  shakeTime: number
  flashTime: number
  backgroundTime: number
  nextCustomerId: number
  nextEffectId: number
  /** 今回のゲームの内部カウンタ（実績計算用）。 */
  runStats: RunStats
  /** 今回のゲームで新たに解除された実績ID（リザルト画面表示用）。 */
  newlyUnlocked: string[]
  /** ゲーム中にキューイングされたトースト。renderDom が読み出して消化する。 */
  achievementToasts: AchievementToast[]
  /** 今回の難易度のトップ5（リザルトで表示）。プレイ中は空。 */
  leaderboard: LeaderboardEntry[]
  /** 今回のスコアがランクインした順位（0始まり、圏外は -1）。 */
  leaderboardPlace: number
}
