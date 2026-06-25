import { CONFIG, FOOD_ORDER, createInitialState, getRank, writeHighScore } from './state'
import type { Customer, FloatingText, GameState, InputState } from './types'

export function update(state: GameState, dt: number, input: InputState): void {
  const safeDt = Math.min(Math.max(dt, 0), 0.1)
  state.backgroundTime += safeDt

  if (state.scene === 'title') {
    if (input.startRequested) {
      startGame(state)
    }
    return
  }

  if (state.scene === 'result') {
    updateEffects(state, safeDt)
    if (input.restartRequested || input.startRequested) {
      startGame(state)
    }
    return
  }

  updatePlaying(state, safeDt, input)
}

function startGame(state: GameState): void {
  const fresh = createInitialState('playing')
  // Reuse the single source of truth in state.ts, but keep the live high score
  // and let the animated background carry over for a seamless transition.
  Object.assign(state, fresh, {
    highScore: state.highScore,
    backgroundTime: state.backgroundTime,
    spawnTimer: 0.65,
  })
}

function updatePlaying(state: GameState, dt: number, input: InputState): void {
  state.elapsed += dt
  state.timeRemaining = Math.max(0, CONFIG.gameDuration - state.elapsed)

  updateFoods(state, dt, input)
  updateCustomerQueue(state, dt)
  updateAutoServe(state, dt)
  updateEffects(state, dt)

  if (state.timeRemaining <= 0) {
    finishGame(state)
  }
}

function updateFoods(state: GameState, dt: number, input: InputState): void {
  for (const id of FOOD_ORDER) {
    const food = state.foods[id]
    food.cooldown = Math.max(0, food.cooldown - dt)
    food.pressPulse = Math.max(0, food.pressPulse - dt)

    if (input.refillRequests[id] && food.cooldown <= 0) {
      food.stock = Math.min(100, food.stock + CONFIG.refillAmount)
      food.cooldown = CONFIG.refillCooldown
      food.pressPulse = 0.16
      addFloatingText(state, `+${CONFIG.refillAmount}`, 188 + FOOD_ORDER.indexOf(id) * 210, 424, 'combo')
    }

    const ease = 1 - Math.exp(-dt * 12)
    food.displayStock += (food.stock - food.displayStock) * ease
  }
}

function updateCustomerQueue(state: GameState, dt: number): void {
  state.spawnTimer -= dt
  if (state.spawnTimer <= 0 && state.customers.length < CONFIG.maxCustomers) {
    state.customers.push(createCustomer(state))
    state.spawnTimer += getSpawnInterval(state)
  }

  if (state.spawnTimer <= 0 && state.customers.length >= CONFIG.maxCustomers) {
    state.spawnTimer = 0.12
  }

  let lostAny = false
  state.customers = state.customers.filter((customer, index) => {
    customer.targetX = 148 + index * 154
    customer.x += (customer.targetX - customer.x) * (1 - Math.exp(-dt * 8))
    customer.bobOffset += dt * 4.2

    if (customer.mood === 'waiting') {
      customer.patience = Math.max(0, customer.patience - CONFIG.patienceDrainPerSecond * dt)
      if (customer.patience <= 0) {
        loseCustomer(state, customer)
        lostAny = true
        return false
      }
    }
    return true
  })

  if (lostAny) {
    state.autoServeTimer = 0
  }
}

function updateAutoServe(state: GameState, dt: number): void {
  const head = state.customers[0]
  if (!head || head.mood !== 'waiting') {
    state.autoServeTimer = 0
    return
  }

  const food = state.foods[head.food]
  if (food.stock < CONFIG.serveCost) {
    state.autoServeTimer = 0
    return
  }

  state.autoServeTimer += dt
  head.serveTimer = state.autoServeTimer

  if (state.autoServeTimer >= CONFIG.cookTime) {
    serveCustomer(state, head)
    state.customers.shift()
    state.autoServeTimer = 0
  }
}

function updateEffects(state: GameState, dt: number): void {
  state.comboPulse = Math.max(0, state.comboPulse - dt)
  state.shakeTime = Math.max(0, state.shakeTime - dt)
  state.flashTime = Math.max(0, state.flashTime - dt)

  state.floatingTexts = state.floatingTexts.filter((effect) => {
    effect.age += dt
    effect.y += effect.vy * dt
    return effect.age < effect.duration
  })

  state.departing = state.departing.filter((leaver) => {
    leaver.age += dt
    leaver.y -= 70 * dt
    return leaver.age < leaver.duration
  })
}

function createCustomer(state: GameState): Customer {
  const food = FOOD_ORDER[Math.floor(Math.random() * FOOD_ORDER.length)]
  return {
    id: state.nextCustomerId++,
    food,
    patience: 100,
    mood: 'waiting',
    x: 930,
    y: 190,
    targetX: 148 + state.customers.length * 154,
    bobOffset: Math.random() * Math.PI * 2,
    exitTimer: 0,
    serveTimer: 0,
  }
}

function getSpawnInterval(state: GameState): number {
  const t = Math.min(1, state.elapsed / CONFIG.gameDuration)
  return CONFIG.spawnStart + (CONFIG.spawnEnd - CONFIG.spawnStart) * t
}

function serveCustomer(state: GameState, customer: Customer): void {
  const food = state.foods[customer.food]
  food.stock = Math.max(0, food.stock - CONFIG.serveCost)

  const multiplier = Math.min(CONFIG.maxComboMultiplier, 1 + state.combo * 0.1)
  const serveScore = Math.round(CONFIG.baseServeScore * multiplier)
  const bonus = Math.round((customer.patience / 100) * CONFIG.patienceBonusMax)
  const gained = serveScore + bonus
  state.score += gained
  state.combo += 1
  state.comboPulse = 0.28

  addFloatingText(state, `+${gained}`, customer.x, customer.y - 58, 'good')
}

function loseCustomer(state: GameState, customer: Customer): void {
  customer.mood = 'angry'
  state.score = Math.max(0, state.score - CONFIG.lostPenalty)
  state.combo = 0
  state.comboPulse = 0.22
  state.shakeTime = 0.24
  state.flashTime = 0.18
  // Keep an angry face around briefly so the loss is felt, not just popped away.
  state.departing.push({
    id: customer.id,
    x: customer.x,
    y: customer.y,
    age: 0,
    duration: 0.5,
  })
  addFloatingText(state, `-${CONFIG.lostPenalty}`, customer.x, customer.y - 44, 'bad')
}

function addFloatingText(
  state: GameState,
  text: string,
  x: number,
  y: number,
  tone: FloatingText['tone'],
): void {
  state.floatingTexts.push({
    id: state.nextEffectId++,
    text,
    x,
    y,
    vy: -54,
    age: 0,
    duration: 0.9,
    tone,
  })
}

function finishGame(state: GameState): void {
  state.scene = 'result'
  state.rank = getRank(state.score)
  state.newRecord = state.score > state.highScore
  if (state.newRecord) {
    state.highScore = state.score
    writeHighScore(state.score)
  }
}
