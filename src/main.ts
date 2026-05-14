import { updateGame, renderGame } from './game'

function gameLoop() {
  requestAnimationFrame(gameLoop)
  updateGame()
  renderGame()
}

document.addEventListener('DOMContentLoaded', () => {
  gameLoop()
})
