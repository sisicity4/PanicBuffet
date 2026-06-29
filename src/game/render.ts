import { CONFIG, CUSTOMER_EMOJIS, DIFFICULTY_ORDER, FOOD_ORDER, TUNINGS } from './state'
import { ACHIEVEMENTS, findAchievement, readUnlockedIds } from './achievements'
import type { AchievementToast, Difficulty, FoodId, GameState } from './types'

type RefillHandler = (food: FoodId) => void
type DifficultyHandler = (difficulty: Difficulty) => void

/** トースト表示状態の内部管理（モジュールスコープ）。 */
interface ActiveToast {
  id: string
  el: HTMLDivElement
  timer: ReturnType<typeof setTimeout>
}

interface RendererElements {
  root: HTMLDivElement
  title: HTMLDivElement
  play: HTMLDivElement
  result: HTMLDivElement
  canvas: HTMLCanvasElement
  hudTime: HTMLSpanElement
  hudScore: HTMLSpanElement
  hudCombo: HTMLSpanElement
  hudHigh: HTMLSpanElement
  autoServeBar: HTMLDivElement
  stockRows: Record<FoodId, StockRow>
  resultScore: HTMLDivElement
  resultRank: HTMLDivElement
  resultHigh: HTMLDivElement
  resultRecord: HTMLDivElement
  resultAchievements: HTMLDivElement
  titleHigh: HTMLSpanElement
  titleAchievementsBadge: HTMLSpanElement
  achievementsPanel: HTMLDivElement
  achievementsGrid: HTMLDivElement
  diffButtons: Record<Difficulty, HTMLButtonElement>
  diffBlurb: HTMLParagraphElement
  toastContainer: HTMLDivElement
}

interface StockRow {
  card: HTMLDivElement
  fill: HTMLDivElement
  percent: HTMLSpanElement
  cooldown: HTMLSpanElement
  button: HTMLButtonElement
}

export interface Renderer {
  render: (state: GameState) => void
  resize: () => void
}

const CANVAS_WIDTH = 960
const CANVAS_HEIGHT = 430

export function createRenderer(
  app: HTMLElement,
  onStart: () => void,
  onRestart: () => void,
  onRefill: RefillHandler,
  onSelectDifficulty: DifficultyHandler,
): Renderer {
  /** 現在表示中のトースト。同じ実績は重複表示しない。 */
  const activeToasts = new Map<string, ActiveToast>()

  function showToast(toast: AchievementToast): void {
    if (activeToasts.has(toast.id)) return

    const el = document.createElement('div')
    el.className = 'achievement-toast'
    el.innerHTML = `<span class="toast-emoji">${toast.emoji}</span><div class="toast-body"><div class="toast-label">実績解除！</div><div class="toast-name">${toast.name}</div></div>`
    elements.toastContainer.append(el)

    // アニメーション: 次フレームで visible クラスを付けてスライドイン
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.classList.add('visible')
      })
    })

    const timer = setTimeout(() => {
      el.classList.remove('visible')
      el.classList.add('hiding')
      setTimeout(() => {
        el.remove()
        activeToasts.delete(toast.id)
      }, 400)
    }, 3200)

    activeToasts.set(toast.id, { id: toast.id, el, timer })
  }

  /** タイトル画面の実績パネル開閉フラグ */
  let achievementsPanelOpen = false

  function toggleAchievementsPanel(): void {
    achievementsPanelOpen = !achievementsPanelOpen
    refreshAchievementsGrid(elements.achievementsGrid)
    elements.achievementsPanel.hidden = !achievementsPanelOpen
    elements.achievementsPanel.classList.toggle('open', achievementsPanelOpen)
  }

  const elements = createDom(app, onStart, onRestart, onRefill, onSelectDifficulty, toggleAchievementsPanel)
  const context = elements.canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas 2D context is unavailable')
  }
  const ctx = context

  function resize(): void {
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
    elements.canvas.width = Math.round(CANVAS_WIDTH * dpr)
    elements.canvas.height = Math.round(CANVAS_HEIGHT * dpr)
    elements.canvas.style.width = '100%'
    elements.canvas.style.height = 'auto'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  resize()

  return {
    render(state) {
      // トーストキューを消化する
      while (state.achievementToasts.length > 0) {
        const toast = state.achievementToasts.shift()!
        showToast(toast)
      }
      renderDom(elements, state)
      renderCanvas(ctx, state)
    },
    resize,
  }
}

function createDom(
  app: HTMLElement,
  onStart: () => void,
  onRestart: () => void,
  onRefill: RefillHandler,
  onSelectDifficulty: DifficultyHandler,
  onToggleAchievements: () => void,
): RendererElements {
  app.innerHTML = ''

  const root = document.createElement('div')
  root.className = 'game-shell'

  const title = document.createElement('div')
  title.className = 'scene scene-title'
  title.innerHTML = `
    <div class="title-mark">🍽️</div>
    <h1>Panic Buffet</h1>
    <p class="lead">2分間、在庫を切らさずお客の波をさばくビュッフェ管理ゲーム。</p>
    <div class="how-to">
      <span>🍕 1</span>
      <span>🍝 2</span>
      <span>🥤 3</span>
    </div>
    <p class="high-note">最高スコア <span data-title-high>0</span></p>
  `

  // 実績パネル
  const achievementsPanel = document.createElement('div')
  achievementsPanel.className = 'achievements-panel'
  achievementsPanel.hidden = true

  const achPanelHeader = document.createElement('div')
  achPanelHeader.className = 'achievements-panel-header'
  achPanelHeader.innerHTML = '<span>🏅 実績</span>'

  const achievementsGrid = document.createElement('div')
  achievementsGrid.className = 'achievements-grid'

  achievementsPanel.append(achPanelHeader, achievementsGrid)

  const difficultyWrap = document.createElement('div')
  difficultyWrap.className = 'difficulty'
  const diffButtons = {} as Record<Difficulty, HTMLButtonElement>
  for (const id of DIFFICULTY_ORDER) {
    const tuning = TUNINGS[id]
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'diff-button'
    button.dataset.diff = id
    button.innerHTML = `<span class="diff-emoji">${tuning.emoji}</span><span class="diff-name">${tuning.label}</span>`
    button.addEventListener('click', () => onSelectDifficulty(id))
    diffButtons[id] = button
    difficultyWrap.append(button)
  }
  const diffBlurb = document.createElement('p')
  diffBlurb.className = 'diff-blurb'
  const highNote = title.querySelector('.high-note') as HTMLParagraphElement
  title.insertBefore(difficultyWrap, highNote)
  title.insertBefore(diffBlurb, highNote)

  // 実績トグルボタン（ハイスコアの直前に配置）
  const achievementsToggle = document.createElement('button')
  achievementsToggle.className = 'achievements-toggle'
  achievementsToggle.type = 'button'
  achievementsToggle.innerHTML = `🏅 実績 <span class="achievements-badge" data-achievements-badge>0/${ACHIEVEMENTS.length}</span>`
  achievementsToggle.addEventListener('click', onToggleAchievements)

  const highNoteForAch = title.querySelector('.high-note') as HTMLParagraphElement
  title.insertBefore(achievementsToggle, highNoteForAch)
  title.insertBefore(achievementsPanel, highNoteForAch)

  const startButton = document.createElement('button')
  startButton.className = 'primary-button'
  startButton.id = 'start-btn'
  startButton.type = 'button'
  startButton.textContent = 'START'
  startButton.addEventListener('click', onStart)
  title.append(startButton)

  const play = document.createElement('div')
  play.className = 'scene scene-play'
  const hud = document.createElement('div')
  hud.className = 'hud'
  hud.innerHTML = `
    <div class="hud-item timer">⏱ <span data-hud-time>120.0</span></div>
    <div class="hud-item">💰 <span data-hud-score>0</span></div>
    <div class="hud-item combo">🔥 <span data-hud-combo>0</span></div>
    <div class="hud-item">🏆 <span data-hud-high>0</span></div>
  `
  const stageWrap = document.createElement('div')
  stageWrap.className = 'stage-wrap'
  const canvas = document.createElement('canvas')
  canvas.className = 'game-canvas'
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT
  stageWrap.append(canvas)
  const autoServe = document.createElement('div')
  autoServe.className = 'auto-serve'
  autoServe.innerHTML = '<span>調理中</span><div class="auto-track"><div data-auto-serve-bar></div></div>'

  const stockPanel = document.createElement('div')
  stockPanel.className = 'stock-panel'
  const stockRows = {} as Record<FoodId, StockRow>
  for (const id of FOOD_ORDER) {
    const card = document.createElement('div')
    card.className = 'stock-card'
    card.innerHTML = `
      <div class="stock-top">
        <span class="stock-food"></span>
        <span class="stock-percent"></span>
      </div>
      <div class="stock-bar"><div class="stock-fill"></div></div>
      <button class="refill-button" type="button">
        <span>補充</span>
        <span class="cooldown-fill"></span>
      </button>
    `
    const foodLabel = card.querySelector<HTMLSpanElement>('.stock-food')
    const percent = card.querySelector<HTMLSpanElement>('.stock-percent')
    const fill = card.querySelector<HTMLDivElement>('.stock-fill')
    const button = card.querySelector<HTMLButtonElement>('button')
    const cooldown = card.querySelector<HTMLSpanElement>('.cooldown-fill')
    if (!foodLabel || !percent || !fill || !button || !cooldown) {
      throw new Error('Stock panel markup failed')
    }
    button.addEventListener('click', () => onRefill(id))
    stockRows[id] = { card, fill, percent, cooldown, button }
    stockPanel.append(card)
  }

  play.append(hud, stageWrap, autoServe, stockPanel)

  const result = document.createElement('div')
  result.className = 'scene scene-result'
  result.innerHTML = `
    <div class="result-kicker">RESULT</div>
    <div class="result-rank" data-result-rank>D</div>
    <div class="result-score" data-result-score>0</div>
    <div class="result-record" data-result-record></div>
    <div class="result-high" data-result-high>最高 0</div>
  `

  // 今回解除した実績リスト（ゲーム終了時のみ表示）
  const resultAchievements = document.createElement('div')
  resultAchievements.className = 'result-achievements'
  resultAchievements.hidden = true
  result.append(resultAchievements)

  const restartButton = document.createElement('button')
  restartButton.className = 'primary-button'
  restartButton.id = 'restart-btn'
  restartButton.type = 'button'
  restartButton.textContent = 'もう一回'
  restartButton.addEventListener('click', onRestart)
  result.append(restartButton)

  // トーストコンテナ（ゲーム中の実績通知）
  const toastContainer = document.createElement('div')
  toastContainer.className = 'toast-container'

  root.append(title, play, result)
  app.append(root, toastContainer)

  return {
    root,
    title,
    play,
    result,
    canvas,
    hudTime: hud.querySelector('[data-hud-time]') as HTMLSpanElement,
    hudScore: hud.querySelector('[data-hud-score]') as HTMLSpanElement,
    hudCombo: hud.querySelector('[data-hud-combo]') as HTMLSpanElement,
    hudHigh: hud.querySelector('[data-hud-high]') as HTMLSpanElement,
    autoServeBar: autoServe.querySelector('[data-auto-serve-bar]') as HTMLDivElement,
    stockRows,
    resultScore: result.querySelector('[data-result-score]') as HTMLDivElement,
    resultRank: result.querySelector('[data-result-rank]') as HTMLDivElement,
    resultHigh: result.querySelector('[data-result-high]') as HTMLDivElement,
    resultRecord: result.querySelector('[data-result-record]') as HTMLDivElement,
    resultAchievements,
    titleHigh: title.querySelector('[data-title-high]') as HTMLSpanElement,
    titleAchievementsBadge: title.querySelector('[data-achievements-badge]') as HTMLSpanElement,
    achievementsPanel,
    achievementsGrid,
    diffButtons,
    diffBlurb,
    toastContainer,
  }
}

function renderDom(elements: RendererElements, state: GameState): void {
  elements.root.dataset.scene = state.scene
  elements.title.hidden = state.scene !== 'title'
  elements.play.hidden = state.scene !== 'playing'
  elements.result.hidden = state.scene !== 'result'
  elements.root.style.setProperty('--shake-x', `${state.shakeTime > 0 ? Math.sin(state.backgroundTime * 75) * 5 : 0}px`)

  for (const id of DIFFICULTY_ORDER) {
    elements.diffButtons[id].classList.toggle('active', state.difficulty === id)
  }
  elements.diffBlurb.textContent = state.tuning.blurb

  elements.titleHigh.textContent = formatNumber(state.highScore)
  elements.hudTime.textContent = state.timeRemaining.toFixed(1)
  elements.hudScore.textContent = formatNumber(state.score)
  elements.hudCombo.textContent = `${state.combo} x${Math.min(CONFIG.maxComboMultiplier, 1 + state.combo * CONFIG.comboStep).toFixed(1)}`
  elements.hudHigh.textContent = formatNumber(state.highScore)
  elements.hudTime.parentElement?.classList.toggle('danger', state.timeRemaining <= 10)
  elements.hudCombo.parentElement?.classList.toggle('bounce', state.comboPulse > 0)

  const head = state.customers[0]
  const progress = head ? Math.min(1, state.autoServeTimer / state.tuning.cookTime) : 0
  elements.autoServeBar.style.transform = `scaleX(${progress})`

  for (const id of FOOD_ORDER) {
    const food = state.foods[id]
    const row = elements.stockRows[id]
    const rounded = Math.round(food.displayStock)
    // Hard mode gates every station on the single shared kitchen timer.
    const effectiveCooldown = state.tuning.sharedKitchen ? state.kitchenCooldown : food.cooldown
    row.card.classList.toggle('low', food.stock <= CONFIG.lowStockThreshold)
    row.card.classList.toggle('pressed', food.pressPulse > 0)
    row.fill.style.transform = `scaleX(${Math.max(0, Math.min(100, food.displayStock)) / 100})`
    row.percent.textContent = `${rounded}%`
    row.card.querySelector('.stock-food')!.textContent = `${food.emoji} ${food.label} (${food.key})`
    row.button.disabled = effectiveCooldown > 0
    row.button.setAttribute('aria-label', `${food.label}を補充`)
    row.cooldown.style.transform = `scaleX(${Math.min(1, effectiveCooldown / state.tuning.refillCooldown)})`
  }

  elements.resultScore.textContent = `${formatNumber(state.score)} pts`
  elements.resultRank.textContent = state.rank
  elements.resultHigh.textContent = `最高 ${formatNumber(state.highScore)} ・ ${state.tuning.emoji} ${state.tuning.label}`
  elements.resultRecord.textContent = state.newRecord ? '最高更新！' : ''
  elements.result.classList.toggle('new-record', state.newRecord)

  // リザルト画面: 今回解除した実績を列挙する
  renderResultAchievements(elements.resultAchievements, state.newlyUnlocked)

  // タイトル画面: 実績バッジ（解除数/全体数）を更新する
  const unlockedCount = readUnlockedIds().size
  elements.titleAchievementsBadge.textContent = `${unlockedCount}/${ACHIEVEMENTS.length}`
}

/** リザルト画面: 今回の新規解除実績を表示する。 */
function renderResultAchievements(container: HTMLDivElement, newlyUnlocked: string[]): void {
  container.hidden = newlyUnlocked.length === 0
  if (newlyUnlocked.length === 0) return

  // 内容が変わっていない場合は再描画しない（IDを確認）
  const prev = container.dataset.ids ?? ''
  const next = newlyUnlocked.join(',')
  if (prev === next) return
  container.dataset.ids = next

  container.innerHTML = '<div class="result-ach-label">✨ 実績解除！</div>'
  for (const id of newlyUnlocked) {
    const ach = findAchievement(id)
    if (!ach) continue
    const item = document.createElement('div')
    item.className = 'result-ach-item'
    item.innerHTML = `<span class="result-ach-emoji">${ach.emoji}</span><div class="result-ach-info"><div class="result-ach-name">${ach.name}</div><div class="result-ach-desc">${ach.description}</div></div>`
    container.append(item)
  }
}

/**
 * タイトル画面の実績グリッドを最新の解除状態で描画する。
 * ボタンクリック時に呼ばれる（毎フレームではない）。
 */
function refreshAchievementsGrid(grid: HTMLDivElement): void {
  grid.innerHTML = ''
  const unlockedIds = readUnlockedIds()
  for (const ach of ACHIEVEMENTS) {
    const unlocked = unlockedIds.has(ach.id)
    const item = document.createElement('div')
    item.className = `ach-item${unlocked ? ' unlocked' : ' locked'}`
    if (unlocked) {
      item.innerHTML = `<span class="ach-emoji">${ach.emoji}</span><div class="ach-info"><div class="ach-name">${ach.name}</div><div class="ach-desc">${ach.description}</div></div>`
    } else if (ach.secret) {
      item.innerHTML = `<span class="ach-emoji locked-emoji">🔒</span><div class="ach-info"><div class="ach-name">???</div><div class="ach-desc">秘密の実績</div></div>`
    } else {
      item.innerHTML = `<span class="ach-emoji locked-emoji">🔒</span><div class="ach-info"><div class="ach-name">${ach.name}</div><div class="ach-desc">${ach.description}</div></div>`
    }
    grid.append(item)
  }
}

function renderCanvas(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  drawBackground(ctx, state)
  drawCounters(ctx)
  drawQueueGuides(ctx)
  drawCustomers(ctx, state)
  drawDeparting(ctx, state)
  drawFloatingTexts(ctx, state)

  if (state.flashTime > 0) {
    ctx.fillStyle = `rgba(255, 76, 98, ${0.22 * (state.flashTime / 0.18)})`
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, state: GameState): void {
  const drift = Math.sin(state.backgroundTime * 0.45) * 28
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  gradient.addColorStop(0, '#fff4d6')
  gradient.addColorStop(0.48, '#ffe4ea')
  gradient.addColorStop(1, '#d7f3ee')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  ctx.globalAlpha = 0.22
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 8; i += 1) {
    const x = ((i * 163 + drift) % 1040) - 40
    const y = 54 + (i % 3) * 106
    roundedRect(ctx, x, y, 116, 38, 19)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function drawCounters(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(255,255,255,0.68)'
  roundedRect(ctx, 36, 290, 888, 92, 24)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  roundedRect(ctx, 70, 316, 820, 40, 20)
  ctx.fill()
  ctx.fillStyle = '#f1b55a'
  ctx.fillRect(84, 332, 792, 8)
  ctx.font = '700 28px system-ui, sans-serif'
  ctx.fillStyle = '#7b4f24'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('BUFFET LINE', 62, 268)
}

function drawQueueGuides(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = 'rgba(112, 86, 66, 0.18)'
  ctx.lineWidth = 3
  ctx.setLineDash([10, 10])
  for (let i = 0; i < CONFIG.maxCustomers; i += 1) {
    roundedRect(ctx, 104 + i * 154, 92, 88, 158, 24)
    ctx.stroke()
  }
  ctx.setLineDash([])
}

function drawCustomers(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const [index, customer] of state.customers.entries()) {
    const food = state.foods[customer.food]
    const bob = Math.sin(customer.bobOffset) * 4
    const isHead = index === 0
    const x = customer.x
    const y = customer.y + bob
    const headEmoji = isHead && state.autoServeTimer > 0.35 ? '😋' : CUSTOMER_EMOJIS[customer.id % CUSTOMER_EMOJIS.length]

    ctx.save()
    if (isHead && state.autoServeTimer > 0) {
      const bounce = 1 + Math.sin(state.autoServeTimer * 16) * 0.025
      ctx.translate(x, y)
      ctx.scale(bounce, bounce)
      ctx.translate(-x, -y)
    }

    drawBubble(ctx, x + 44, y - 108, food.emoji)
    drawPatience(ctx, x - 44, y - 74, customer.patience)

    ctx.font = '64px system-ui, Apple Color Emoji, Segoe UI Emoji'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(headEmoji, x, y)

    ctx.fillStyle = 'rgba(80, 58, 46, 0.16)'
    ctx.beginPath()
    ctx.ellipse(x, y + 55, 38, 10, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function drawDeparting(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const leaver of state.departing) {
    const ratio = leaver.age / leaver.duration
    const wobble = Math.sin(leaver.age * 36) * 7
    ctx.save()
    ctx.globalAlpha = Math.max(0, 1 - ratio)
    ctx.font = '64px system-ui, Apple Color Emoji, Segoe UI Emoji'
    ctx.fillText('😡', leaver.x + wobble, leaver.y)
    ctx.restore()
  }
  ctx.globalAlpha = 1
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, emoji: string): void {
  ctx.fillStyle = '#ffffff'
  roundedRect(ctx, x - 32, y - 24, 64, 48, 20)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(x - 8, y + 18)
  ctx.lineTo(x - 20, y + 35)
  ctx.lineTo(x + 8, y + 22)
  ctx.closePath()
  ctx.fill()
  ctx.font = '28px system-ui, Apple Color Emoji, Segoe UI Emoji'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#33251f'
  ctx.fillText(emoji, x, y)
}

function drawPatience(ctx: CanvasRenderingContext2D, x: number, y: number, patience: number): void {
  const ratio = Math.max(0, Math.min(1, patience / 100))
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  roundedRect(ctx, x, y, 88, 10, 5)
  ctx.fill()
  ctx.fillStyle = ratio > 0.45 ? '#34c88a' : ratio > 0.22 ? '#f5b63f' : '#f45b69'
  roundedRect(ctx, x, y, 88 * ratio, 10, 5)
  ctx.fill()
}

function drawFloatingTexts(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const effect of state.floatingTexts) {
    const ratio = effect.age / effect.duration
    const alpha = 1 - ratio
    ctx.globalAlpha = Math.max(0, alpha)
    ctx.font = '800 30px system-ui, sans-serif'
    ctx.fillStyle = effect.tone === 'bad' ? '#e83d51' : effect.tone === 'combo' ? '#2b9bd7' : '#18a76d'
    ctx.fillText(effect.text, effect.x, effect.y)
  }
  ctx.globalAlpha = 1
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function formatNumber(value: number): string {
  return Math.floor(value).toLocaleString('en-US')
}
