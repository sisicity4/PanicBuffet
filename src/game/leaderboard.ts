import type { Difficulty, LeaderboardEntry, Rank } from './types'

// 難易度別のローカルランキング（トップ5）。最高スコア(readHighScore)と同じく
// localStorage を全 try/catch でガードし、private-browsing でも落ちないようにする。

const LEADERBOARD_PREFIX = 'panicbuffet.leaderboard'
export const LEADERBOARD_SIZE = 5

function key(difficulty: Difficulty): string {
  return `${LEADERBOARD_PREFIX}.${difficulty}`
}

export function readLeaderboard(difficulty: Difficulty): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(key(difficulty))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((e): e is LeaderboardEntry => e && typeof e.score === 'number')
      .sort((a, b) => b.score - a.score)
      .slice(0, LEADERBOARD_SIZE)
  } catch {
    return []
  }
}

function writeLeaderboard(difficulty: Difficulty, entries: LeaderboardEntry[]): void {
  try {
    localStorage.setItem(key(difficulty), JSON.stringify(entries.slice(0, LEADERBOARD_SIZE)))
  } catch {
    // Storage can be unavailable in private browsing; the game still runs.
  }
}

/**
 * スコアをランキングに登録して永続化し、更新後のトップ5と、今回のスコアが
 * 入った順位（0始まり、圏外は -1）を返す。
 */
export function recordScore(
  difficulty: Difficulty,
  score: number,
  rank: Rank,
  date: string,
): { entries: LeaderboardEntry[]; placedIndex: number } {
  const entry: LeaderboardEntry = { score, rank, date }
  const sorted = [...readLeaderboard(difficulty), entry].sort((a, b) => b.score - a.score)
  const placedIndex = sorted.indexOf(entry) // 参照一致で今回の位置を特定
  const top = sorted.slice(0, LEADERBOARD_SIZE)
  writeLeaderboard(difficulty, top)
  return { entries: top, placedIndex: placedIndex < LEADERBOARD_SIZE ? placedIndex : -1 }
}
