// One-off balance probe — runs the pure game logic (no browser) per difficulty
// with a "competent" bot that protects the head customer, then tops up the
// lowest station. Reports score / rank / lost guests so we can sanity-check the
// difficulty curve and rank thresholds. Run: node_modules/.bin/tsx scripts/measure-difficulty.mjs
import { update } from '../src/game/update.ts'
import { CONFIG, DIFFICULTY_ORDER, TUNINGS, createInitialState } from '../src/game/state.ts'

const TRIALS = Number(process.env.TRIALS || 8)
// Human reaction window (ms): the bot can only react/press this often, so it
// mis-times under pressure. This is what makes faster difficulties actually hard.
const REACTION = Number(process.env.REACTION || 280) / 1000

function playOnce(difficulty) {
  const state = createInitialState('playing', difficulty)
  state.spawnTimer = 0.65
  const tuning = TUNINGS[difficulty]
  const dt = 1 / 60
  let prevScore = 0
  let losses = 0
  let nextActionAt = 0
  for (let t = 0; t < CONFIG.gameDuration; t += dt) {
    const input = { refillRequests: {}, startRequested: false, restartRequested: false }
    if (t >= nextActionAt) {
      const pick = chooseRefill(state, tuning)
      if (pick) {
        input.refillRequests[pick] = true
        nextActionAt = t + REACTION
      }
    }
    update(state, dt, input)
    if (state.score < prevScore) losses += Math.round((prevScore - state.score) / tuning.lostPenalty)
    prevScore = state.score
  }
  return { score: state.score, rank: state.rank, losses }
}

// Bot: keep the head servable first (it gates the whole line), then top up the
// lowest station that has dipped under half.
function chooseRefill(state, tuning) {
  const head = state.customers[0]
  if (head && state.foods[head.food].stock < tuning.serveCost + 6) return head.food
  const low = Object.values(state.foods).sort((a, b) => a.stock - b.stock)[0]
  return low.stock < 50 ? low.id : null
}

const avg = (rows, k) => Math.round(rows.reduce((s, r) => s + r[k], 0) / rows.length)
console.log(`difficulty   avgScore   avgLost   S-thresh   ranks(${TRIALS})`)
for (const d of DIFFICULTY_ORDER) {
  const rows = Array.from({ length: TRIALS }, () => playOnce(d))
  const ranks = rows.map((r) => r.rank).join('')
  console.log(
    `${d.padEnd(11)}  ${String(avg(rows, 'score')).padStart(7)}  ${String(avg(rows, 'losses')).padStart(7)}  ${String(TUNINGS[d].rankThresholds.S).padStart(8)}   ${ranks}`,
  )
}
