// One-off demo recorder: drives the real game in headless Chrome with a simple
// "keep stocks topped up" bot and saves PNG frames for ffmpeg to turn into a GIF.
// Not part of the app build — run manually: `node scripts/capture-demo.mjs`.
import puppeteer from 'puppeteer-core'
import { mkdirSync, rmSync } from 'node:fs'

const URL = process.env.DEMO_URL || 'http://localhost:4180'
const CHROME =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = '/tmp/pb-frames'
const FRAMES = 52
const STEP_MS = 90

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb'],
  defaultViewport: { width: 1120, height: 760, deviceScaleFactor: 2 },
})

const page = await browser.newPage()
await page.goto(URL, { waitUntil: 'networkidle0' })
await page.waitForSelector('#start-btn')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pad = (n) => String(n).padStart(3, '0')
const KEY = { pizza: '1', pasta: '2', drink: '3' }

// Throttled serving keeps the buffet line full: only top up the FRONT customer's
// food once every few frames, so 3-4 guests stay queued (with bubbles + patience
// bars) and get cleared in steady combo bursts instead of vanishing instantly.
async function serveFront() {
  const need = await page.evaluate(() => {
    const s = JSON.parse(window.render_game_to_text())
    if (s.scene !== 'playing' || !s.customers.length) return null
    return s.customers[0].request
  })
  if (need) await page.keyboard.press(KEY[need])
}

// Title beat (held a moment in the reel)
for (let t = 0; t < 6; t++) await page.screenshot({ path: `${OUT}/${pad(t)}.png` })
await page.click('#start-btn')

// Freeze the real-time rAF loop so the sim ONLY advances when we say so. Without
// this the loop auto-serves the front faster than guests arrive and the line
// never looks busy. After this, window.advanceTime() is the single clock.
await page.evaluate(() => {
  window.requestAnimationFrame = () => 0
})
await sleep(60)

// Build a hungry line off-camera: advance with no refills until stocks are fully
// drained and guests stack the queue to its cap.
await page.evaluate(() => {
  for (let k = 0; k < 700; k++) window.advanceTime(50)
})

// Record: top up the front guest's food every few frames so the full line keeps
// flowing into steady combos, with the odd skip to let an angry guest stomp off.
const SIM_MS = 120
for (let i = 6; i < FRAMES; i++) {
  if (i % 5 === 0) await serveFront()
  await page.evaluate((ms) => window.advanceTime(ms), SIM_MS)
  await page.screenshot({ path: `${OUT}/${pad(i)}.png` })
}

await browser.close()
console.log(`captured ${FRAMES} frames to ${OUT}`)
