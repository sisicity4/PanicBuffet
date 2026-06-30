// One-off demo recorder: drives the real game in headless Chromium and saves PNG
// frames for ffmpeg to turn into a GIF. Freezes the rAF loop and steps the sim
// via window.advanceTime so the buffet line stays busy on camera.
// Run manually: `node scripts/capture-demo.mjs` (needs `npm i --no-save playwright`
// + `npx playwright install chromium`). DEMO_URL points at a running dev server.
import { chromium } from 'playwright'
import { mkdirSync, rmSync } from 'node:fs'

const URL = process.env.DEMO_URL || 'http://localhost:4180'
const OUT = '/tmp/pb-frames'
const FRAMES = 56
const SIM_MS = 120

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  args: ['--no-sandbox', '--disable-gpu', '--force-color-profile=srgb'],
})
const page = await browser.newPage({
  viewport: { width: 1120, height: 760 },
  deviceScaleFactor: 2,
})
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('#start-btn')

const pad = (n) => String(n).padStart(3, '0')
const KEY = { pizza: '1', pasta: '2', drink: '3' }

// Throttled serving keeps the buffet line full: top up the FRONT guest's food
// every few frames so 3-4 guests stay queued and clear in steady combo bursts.
async function serveFront() {
  const need = await page.evaluate(() => {
    const s = JSON.parse(window.render_game_to_text())
    if (s.scene !== 'playing' || !s.customers.length) return null
    return s.customers[0].request
  })
  if (need) await page.keyboard.press(KEY[need])
}

// Title beat (now shows the difficulty selector) held a moment in the reel.
for (let t = 0; t < 7; t++) await page.screenshot({ path: `${OUT}/${pad(t)}.png` })
await page.click('#start-btn')

// Freeze the real-time rAF loop so the sim ONLY advances when we step it. Without
// this the loop auto-serves the front faster than guests arrive and the line
// never looks busy. After this, window.advanceTime() is the single clock.
await page.evaluate(() => {
  window.requestAnimationFrame = () => 0
})
await page.waitForTimeout(60)

// Build a hungry line off-camera: advance with no refills until stocks drain and
// guests stack the queue to its cap.
await page.evaluate(() => {
  for (let k = 0; k < 700; k++) window.advanceTime(50)
})

// Record: top up the front guest's food every few frames so the full line keeps
// flowing into steady combos, with the odd skip to let an angry guest stomp off.
for (let i = 7; i < FRAMES; i++) {
  if (i % 5 === 0) await serveFront()
  await page.evaluate((ms) => window.advanceTime(ms), SIM_MS)
  await page.screenshot({ path: `${OUT}/${pad(i)}.png` })
}

await browser.close()
console.log(`captured ${FRAMES} frames to ${OUT}`)
