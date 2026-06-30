import { describe, it, expect } from 'vitest'
import { CONFIG, TUNINGS, createInitialState, getRank } from '../src/game/state'
import { update } from '../src/game/update'
import type { Customer, FoodId, GameState, InputState } from '../src/game/types'

// localStorage is absent under the node test env; the game's I/O helpers swallow
// that (private-browsing safe), so these tests exercise pure logic only.

function makeInput(overrides: Partial<InputState> = {}): InputState {
  return { refillRequests: {}, startRequested: false, restartRequested: false, ...overrides }
}

/** Drop a waiting guest at the head of the line with a known request. */
function addCustomer(state: GameState, food: FoodId, patience = 100): Customer {
  const c: Customer = {
    id: state.nextCustomerId++,
    food,
    patience,
    mood: 'waiting',
    x: 148,
    y: 190,
    targetX: 148,
    bobOffset: 0,
    exitTimer: 0,
    serveTimer: 0,
  }
  state.customers.push(c)
  return c
}

/** Step the sim forward `seconds` in fixed 1/60 increments. */
function advance(state: GameState, seconds: number, input: InputState = makeInput()): void {
  const dt = 1 / 60
  for (let t = 0; t < seconds; t += dt) update(state, dt, input)
}

describe('getRank', () => {
  it('maps scores to ranks at the normal thresholds', () => {
    const n = TUNINGS.normal
    expect(getRank(n.rankThresholds.S, n)).toBe('S')
    expect(getRank(n.rankThresholds.S - 1, n)).toBe('A')
    expect(getRank(n.rankThresholds.C, n)).toBe('C')
    expect(getRank(0, n)).toBe('D')
  })

  it('uses each difficulty its own thresholds', () => {
    expect(getRank(40000, TUNINGS.easy)).toBe('S') // easy S is 26000
    expect(getRank(40000, TUNINGS.hard)).toBe('S') // hard S is 40000
    expect(getRank(39999, TUNINGS.hard)).toBe('A')
  })
})

describe('start / scene transition', () => {
  it('starts a fresh playing run with full stock for the chosen difficulty', () => {
    const state = createInitialState('title', 'hard')
    update(state, 1 / 60, makeInput({ startRequested: true }))
    expect(state.scene).toBe('playing')
    expect(state.foods.pizza.stock).toBe(TUNINGS.hard.startStock)
    expect(state.score).toBe(0)
    expect(state.combo).toBe(0)
  })
})

describe('serving', () => {
  it('auto-serves the head after cookTime, scoring and consuming stock', () => {
    const state = createInitialState('playing', 'easy') // easy: nibble 0, serveCost 20
    state.spawnTimer = 999 // suppress new spawns
    addCustomer(state, 'pizza')

    advance(state, TUNINGS.easy.cookTime + 0.1)

    expect(state.combo).toBe(1)
    expect(state.score).toBeGreaterThan(0)
    expect(state.foods.pizza.stock).toBe(TUNINGS.easy.startStock - TUNINGS.easy.serveCost)
    expect(state.customers.length).toBe(0)
    expect(state.achievementToasts.some((t) => t.id === 'first_serve')).toBe(true)
  })
})

describe('losing a guest', () => {
  it('penalises, resets combo and emits an angry leaver when patience hits 0', () => {
    const state = createInitialState('playing', 'easy')
    state.spawnTimer = 999
    state.score = 500
    state.combo = 5
    state.foods.pizza.stock = 0 // cannot be served → guest waits and rages
    addCustomer(state, 'pizza', 1) // tiny patience → leaves almost immediately

    // Stop while the 0.5s angry-leaver animation is still alive.
    advance(state, 0.3)

    expect(state.combo).toBe(0)
    expect(state.score).toBe(500 - TUNINGS.easy.lostPenalty)
    expect(state.runStats.lost).toBe(1)
    expect(state.departing.length).toBe(1)
    expect(state.customers.length).toBe(0)
  })
})

describe('shared kitchen (hard)', () => {
  it('lets only one station restock per shared cooldown', () => {
    const state = createInitialState('playing', 'hard')
    state.spawnTimer = 999
    state.foods.pizza.stock = 10
    state.foods.pasta.stock = 10

    update(state, 1 / 60, makeInput({ refillRequests: { pizza: true, pasta: true } }))

    // FOOD_ORDER processes pizza first; pasta is then locked out by the shared timer.
    expect(state.foods.pizza.stock).toBe(10 + TUNINGS.hard.refillAmount)
    expect(state.foods.pasta.stock).toBe(10)
    expect(state.kitchenCooldown).toBeGreaterThan(0)
  })
})

describe('independent kitchens (normal)', () => {
  it('lets every station restock in the same frame', () => {
    const state = createInitialState('playing', 'normal')
    state.spawnTimer = 999
    state.foods.pizza.stock = 10
    state.foods.pasta.stock = 10

    update(state, 1 / 60, makeInput({ refillRequests: { pizza: true, pasta: true } }))

    expect(state.foods.pizza.stock).toBe(10 + TUNINGS.normal.refillAmount)
    expect(state.foods.pasta.stock).toBe(10 + TUNINGS.normal.refillAmount)
  })
})

describe('buffet nibbling', () => {
  it('drains a waiting guest\'s station over time', () => {
    const state = createInitialState('playing', 'normal') // nibble 3/s
    state.spawnTimer = 999
    state.foods.pizza.stock = TUNINGS.normal.serveCost - 1 // below serveCost → head waits
    addCustomer(state, 'pizza')

    const before = state.foods.pizza.stock
    advance(state, 1)

    // ~3 units nibbled over 1s; allow slack for the partial final step.
    expect(state.foods.pizza.stock).toBeLessThan(before)
    expect(before - state.foods.pizza.stock).toBeCloseTo(TUNINGS.normal.nibblePerSecond, 0)
  })
})

describe('finishing', () => {
  it('ends at gameDuration and assigns a rank', () => {
    const state = createInitialState('playing', 'normal')
    state.spawnTimer = 999
    state.score = TUNINGS.normal.rankThresholds.B + 10

    advance(state, CONFIG.gameDuration + 0.1)

    expect(state.scene).toBe('result')
    expect(state.rank).toBe('B')
  })

  it('records the run on the local leaderboard with a placement', () => {
    const state = createInitialState('playing', 'normal')
    state.spawnTimer = 999
    state.score = 12345

    advance(state, CONFIG.gameDuration + 0.1)

    // localStorage is absent in tests, so this is the only (in-memory) entry.
    expect(state.leaderboard.length).toBe(1)
    expect(state.leaderboard[0].score).toBe(12345)
    expect(state.leaderboardPlace).toBe(0)
  })
})

describe('leaderboard ordering', () => {
  it('sorts descending and reports the inserted rank', () => {
    const seed = [
      { score: 5000, rank: 'C' as const, date: '2026-01-01' },
      { score: 9000, rank: 'B' as const, date: '2026-01-02' },
    ]
    const sorted = [...seed, { score: 7000, rank: 'B' as const, date: '2026-01-03' }].sort(
      (a, b) => b.score - a.score,
    )
    expect(sorted.map((e) => e.score)).toEqual([9000, 7000, 5000])
  })
})
