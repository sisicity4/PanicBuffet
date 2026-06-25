export type {
  Customer,
  FloatingText,
  Food,
  FoodId,
  GameState,
  InputState,
  Rank,
  Scene,
} from './types'
export { CONFIG, FOOD_ORDER, createInitialState, getRank, readHighScore, writeHighScore } from './state'
export { update } from './update'
export { createRenderer } from './render'
