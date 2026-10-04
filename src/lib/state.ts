/**
 * Mutable, per-frame shared state. Read inside useFrame / rAF loops;
 * React never re-renders from it.
 */
export const state = {
  /** Overall scroll progress of the home timeline, 0..1. */
  progress: 0,
  pointer: {
    /** Pixel position. */
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    /** Normalized device coords (-1..1, y up). */
    ndcX: 0,
    ndcY: 0,
    /** performance.now() of the last pointer movement. */
    lastMove: -Infinity,
    /** performance.now() of the last movement / touch / scroll activity. */
    lastActive: -Infinity,
    /** True once the user moved at least once. */
    seen: false,
  },
}

let installed = false
export function installPointerTracking() {
  if (installed) return
  installed = true
  const move = (x: number, y: number) => {
    const p = state.pointer
    p.x = x
    p.y = y
    p.ndcX = (x / window.innerWidth) * 2 - 1
    p.ndcY = -(y / window.innerHeight) * 2 + 1
    p.lastActive = p.lastMove = performance.now()
    p.seen = true
  }
  window.addEventListener('pointermove', (e) => move(e.clientX, e.clientY), { passive: true })
  window.addEventListener('pointerdown', (e) => move(e.clientX, e.clientY), { passive: true })
  window.addEventListener(
    'scroll',
    () => {
      state.pointer.lastActive = performance.now()
    },
    { passive: true },
  )
}

/** Lets scripted cursors (record mode) drive the same pointer state. */
export function setPointer(x: number, y: number) {
  const p = state.pointer
  p.x = x
  p.y = y
  p.ndcX = (x / window.innerWidth) * 2 - 1
  p.ndcY = -(y / window.innerHeight) * 2 + 1
  p.lastActive = p.lastMove = performance.now()
  p.seen = true
}
