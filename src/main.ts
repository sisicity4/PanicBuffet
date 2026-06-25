import './style.css'
import {
  CONFIG,
  FOOD_ORDER,
  createInitialState,
  createRenderer,
  update,
  type FoodId,
  type GameState,
  type InputState,
} from './game'

declare global {
  interface Window {
    render_game_to_text?: () => string
    advanceTime?: (ms: number) => void
  }
}

const state = createInitialState()
const input: InputState = {
  refillRequests: {},
  startRequested: false,
  restartRequested: false,
}

const app = document.querySelector<HTMLElement>('#app')
if (!app) {
  throw new Error('#app element not found')
}
const appElement = app

const renderer = createRenderer(appElement, requestStart, requestRestart, requestRefill)
renderer.render(state)

let lastTime = performance.now()

function frame(now: number): void {
  const dt = (now - lastTime) / 1000
  lastTime = now
  step(dt)
  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
window.addEventListener('resize', renderer.resize)
window.addEventListener('keydown', handleKeyDown)

window.render_game_to_text = () => renderGameToText(state)
window.advanceTime = (ms: number) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)))
  for (let i = 0; i < steps; i += 1) {
    step(1 / 60)
  }
}

function step(dt: number): void {
  update(state, dt, input)
  clearTransientInput()
  renderer.render(state)
}

function requestStart(): void {
  input.startRequested = true
}

function requestRestart(): void {
  input.restartRequested = true
}

function requestRefill(food: FoodId): void {
  input.refillRequests[food] = true
}

function clearTransientInput(): void {
  input.startRequested = false
  input.restartRequested = false
  input.refillRequests = {}
}

function handleKeyDown(event: KeyboardEvent): void {
  const keyMap: Record<string, FoodId> = {
    '1': 'pizza',
    '2': 'pasta',
    '3': 'drink',
  }

  if (event.key in keyMap) {
    requestRefill(keyMap[event.key])
    event.preventDefault()
    return
  }

  if (event.key === 'Enter' || event.key === ' ') {
    if (state.scene === 'title') requestStart()
    if (state.scene === 'result') requestRestart()
    event.preventDefault()
    return
  }

  if (event.key.toLowerCase() === 'f') {
    toggleFullscreen()
  }
}

function toggleFullscreen(): void {
  if (document.fullscreenElement) {
    void document.exitFullscreen()
  } else {
    void appElement.requestFullscreen()
  }
}

function renderGameToText(gameState: GameState): string {
  return JSON.stringify({
    coordinateSystem: 'canvas origin top-left, x right, y down, width 960, height 430',
    scene: gameState.scene,
    timeRemaining: Number(gameState.timeRemaining.toFixed(2)),
    score: gameState.score,
    combo: gameState.combo,
    highScore: gameState.highScore,
    rank: gameState.rank,
    newRecord: gameState.newRecord,
    autoServeProgress: Number(Math.min(1, gameState.autoServeTimer / CONFIG.cookTime).toFixed(2)),
    departing: gameState.departing.length,
    foods: FOOD_ORDER.map((id) => ({
      id,
      stock: Math.round(gameState.foods[id].stock),
      cooldown: Number(gameState.foods[id].cooldown.toFixed(2)),
    })),
    customers: gameState.customers.map((customer, index) => ({
      index,
      request: customer.food,
      patience: Math.round(customer.patience),
      x: Math.round(customer.x),
      y: Math.round(customer.y),
    })),
  })
}
