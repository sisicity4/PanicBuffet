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
}
