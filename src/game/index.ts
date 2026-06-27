export type {
  Customer,
  Difficulty,
  FloatingText,
  Food,
  FoodId,
  GameState,
  InputState,
  Rank,
  Scene,
  Tuning,
} from './types'
export {
  CONFIG,
  DIFFICULTY_ORDER,
  FOOD_ORDER,
  TUNINGS,
  createInitialState,
  getRank,
  readHighScore,
  writeHighScore,
} from './state'
export { update } from './update'
export { createRenderer } from './render'
