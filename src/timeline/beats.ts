/**
 * The scroll story. Every number is a fraction of the whole home timeline (0..1).
 * Change a beat here and the camera, effects and overlay all follow.
 */
export const STORY_VH = 800

export const BEATS = {
  hero: [0, 0.15],
  face: [0.15, 0.28],
  curse: [0.28, 0.4],
  entrance: [0.4, 0.52],
  rooms: [0.52, 0.82],
  emerald: [0.82, 0.92],
  exit: [0.92, 1],
} as const

export type BeatId = keyof typeof BEATS

/** Four camera stops inside the tree; each has a short travel then a hold. */
export const ROOM_STOPS = [0, 1, 2, 3].map((i) => {
  const [a, b] = BEATS.rooms
  const len = (b - a) / 4
  const start = a + i * len
  return { start, hold: start + len * 0.4, end: start + len }
})

/** Anchor ids used by in-page links (room nav, CTAs). */
export const ANCHORS: { id: string; at: number }[] = [
  { id: 'hero', at: 0 },
  { id: 'face', at: 0.215 },
  { id: 'curse', at: 0.36 },
  { id: 'entrance', at: 0.45 },
  ...ROOM_STOPS.map((r, i) => ({ id: `room-${i + 1}`, at: (r.hold + r.end) / 2 })),
  { id: 'emerald', at: 0.89 },
  { id: 'exit', at: 0.985 },
]

export function beatAt(p: number): BeatId {
  for (const id of Object.keys(BEATS) as BeatId[]) {
    if (p < BEATS[id][1]) return id
  }
  return 'exit'
}

export function roomAt(p: number) {
  return ROOM_STOPS.findIndex((r) => p >= r.start && p < r.end)
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
/** 0 before a, 1 after b, linear between. */
export const ramp = (p: number, a: number, b: number) => clamp01((p - a) / (b - a))
export const smooth = (x: number) => x * x * (3 - 2 * x)
/** Up from a→b, down from c→d. */
export const window4 = (p: number, a: number, b: number, c: number, d: number) =>
  Math.min(ramp(p, a, b), 1 - ramp(p, c, d))
