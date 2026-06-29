/**
 * achievements.ts — 実績システム
 *
 * 永続化: localStorage に2つのキーで保存。
 *   panicbuffet.stats        — 通算プレイ統計（JSON）
 *   panicbuffet.achievements — 解除済み実績IDのセット（JSON 配列）
 *
 * プライベートブラウジング安全: try/catch を全read/writeに付ける。
 */

import type { Difficulty, Rank } from './types'

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export interface Achievement {
  id: string
  emoji: string
  /** 実績名（日本語） */
  name: string
  /** 解除条件の説明（日本語） */
  description: string
  /** true のとき名前と説明を解除前に隠す */
  secret?: boolean
}

/** ゲーム通算プレイ統計。localStorage に永続化される。 */
export interface LifetimeStats {
  totalServed: number
  gamesPlayed: number
  bestCombo: number
}

/** evaluate() に渡す 1回のゲーム終了時の文脈 */
export interface RunContext {
  runServed: number
  runLost: number
  runBestCombo: number
  runScore: number
  rank: Rank
  difficulty: Difficulty
  /** ゲーム終了時の通算統計（今回分を加算済み） */
  lifetime: LifetimeStats
}

// ---------------------------------------------------------------------------
// 実績一覧（12件）
// ---------------------------------------------------------------------------

export const ACHIEVEMENTS: Achievement[] = [
  // ── ゲーム内マイルストーン ─────────────────────────────────────────────
  {
    id: 'first_serve',
    emoji: '🍽️',
    name: 'はじめての一皿',
    description: 'はじめてお客さんに料理を提供した。',
  },
  {
    id: 'combo_x2',
    emoji: '🔥',
    name: 'コンボスタート',
    description: 'コンボ倍率 ×2.0（コンボ 10）を達成した。',
  },
  {
    id: 'combo_x3',
    emoji: '🌟',
    name: '絶好調',
    description: 'コンボ倍率 ×3.0（コンボ 20）を達成した。',
    secret: true,
  },
  {
    id: 'score_25k',
    emoji: '💰',
    name: 'ビッグスコア',
    description: '1ゲームで 25,000 点以上を獲得した。',
  },
  {
    id: 'perfect_run',
    emoji: '🏆',
    name: 'ノーミス完走',
    description: '1ゲームでお客を1人も怒らせずにクリアした。',
    secret: true,
  },
  // ── 通算（ライフタイム）実績 ───────────────────────────────────────────
  {
    id: 'total_100',
    emoji: '👨‍🍳',
    name: '百皿シェフ',
    description: '通算 100 人のお客さんに料理を提供した。',
  },
  {
    id: 'total_1000',
    emoji: '🍱',
    name: '千皿マスター',
    description: '通算 1,000 人のお客さんに料理を提供した。',
    secret: true,
  },
  {
    id: 'games_10',
    emoji: '🎮',
    name: '常連プレイヤー',
    description: 'ゲームを 10 回プレイした。',
  },
  // ── ランク実績 ─────────────────────────────────────────────────────────
  {
    id: 'rank_s_any',
    emoji: '⭐',
    name: 'S ランク達成',
    description: 'いずれかの難易度で S ランクを取得した。',
  },
  {
    id: 'rank_s_hard',
    emoji: '🌶️',
    name: 'Hard S ランク',
    description: 'Hard モードで S ランクを取得した。',
    secret: true,
  },
  {
    id: 'perfect_hard',
    emoji: '💎',
    name: 'ダイヤモンドシェフ',
    description: 'Hard モードで1人も怒らせずにクリアした。',
    secret: true,
  },
  // ── ボーナス ────────────────────────────────────────────────────────────
  {
    id: 'best_combo_30',
    emoji: '🚀',
    name: 'コンボマシン',
    description: '1ゲームでコンボ 30 以上を記録した。',
    secret: true,
  },
]

// ---------------------------------------------------------------------------
// localStorage キー
// ---------------------------------------------------------------------------

const STATS_KEY = 'panicbuffet.stats'
const ACHIEVEMENTS_KEY = 'panicbuffet.achievements'

// ---------------------------------------------------------------------------
// 永続化ヘルパー（try/catch でプライベートブラウジング安全）
// ---------------------------------------------------------------------------

export function readLifetimeStats(): LifetimeStats {
  try {
    const raw = localStorage.getItem(STATS_KEY)
    if (!raw) return defaultStats()
    const parsed = JSON.parse(raw) as Partial<LifetimeStats>
    return {
      totalServed: Number(parsed.totalServed) || 0,
      gamesPlayed: Number(parsed.gamesPlayed) || 0,
      bestCombo: Number(parsed.bestCombo) || 0,
    }
  } catch {
    return defaultStats()
  }
}

export function writeLifetimeStats(stats: LifetimeStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats))
  } catch {
    // プライベートブラウジングではストレージが使えない場合があるが、ゲームは続行する。
  }
}

export function readUnlockedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown[]
    return new Set(arr.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

export function writeUnlockedIds(ids: Set<string>): void {
  try {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify([...ids]))
  } catch {
    // ストレージが使えない場合はスキップ。
  }
}

// ---------------------------------------------------------------------------
// 評価ロジック
// ---------------------------------------------------------------------------

/**
 * ゲーム終了時に呼ぶ。既に解除済みのものを除いた「新たに解除された実績IDの配列」を返す。
 * 内部でローカルストレージを更新する。
 */
export function evaluateEndOfRun(ctx: RunContext): string[] {
  const unlockedIds = readUnlockedIds()
  const newIds: string[] = []

  function tryUnlock(id: string): void {
    if (!unlockedIds.has(id)) {
      unlockedIds.add(id)
      newIds.push(id)
    }
  }

  // ── ゲーム内マイルストーン ─────────────────────────────────
  // first_serve はリアルタイム解除のため update.ts 側でも呼ばれるが、
  // ここでも保険として評価する（二重解除は tryUnlock が防ぐ）。
  if (ctx.runServed >= 1) tryUnlock('first_serve')
  if (ctx.runBestCombo >= 10) tryUnlock('combo_x2')
  if (ctx.runBestCombo >= 20) tryUnlock('combo_x3')
  if (ctx.runScore >= 25000) tryUnlock('score_25k')
  if (ctx.runLost === 0 && ctx.runServed > 0) tryUnlock('perfect_run')
  if (ctx.runBestCombo >= 30) tryUnlock('best_combo_30')

  // ── 通算実績 ────────────────────────────────────────────────
  if (ctx.lifetime.totalServed >= 100) tryUnlock('total_100')
  if (ctx.lifetime.totalServed >= 1000) tryUnlock('total_1000')
  if (ctx.lifetime.gamesPlayed >= 10) tryUnlock('games_10')

  // ── ランク実績 ───────────────────────────────────────────────
  if (ctx.rank === 'S') tryUnlock('rank_s_any')
  if (ctx.rank === 'S' && ctx.difficulty === 'hard') tryUnlock('rank_s_hard')
  if (ctx.runLost === 0 && ctx.runServed > 0 && ctx.difficulty === 'hard') tryUnlock('perfect_hard')

  if (newIds.length > 0) {
    writeUnlockedIds(unlockedIds)
  }

  return newIds
}

/**
 * リアルタイム解除（ゲーム中に呼ぶ）。
 * 指定した実績IDが未解除なら解除してその ID を返す。
 * 既解除なら null を返す。
 */
export function tryUnlockImmediate(id: string): string | null {
  const unlockedIds = readUnlockedIds()
  if (unlockedIds.has(id)) return null
  unlockedIds.add(id)
  writeUnlockedIds(unlockedIds)
  return id
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

function defaultStats(): LifetimeStats {
  return { totalServed: 0, gamesPlayed: 0, bestCombo: 0 }
}

/** IDから実績オブジェクトを引く。見つからなければ null。 */
export function findAchievement(id: string): Achievement | null {
  return ACHIEVEMENTS.find((a) => a.id === id) ?? null
}
