/**
 * Scroll progress through the pinned hero track: 0 at the top, 1 when the camera is
 * inside the mouth. `raw` follows the scrollbar; `p` is the damped value scenes read.
 */
export const heroScroll = {
  raw: 0,
  p: 0,
  /** The track element (set by Hero). */
  track: null as HTMLElement | null,
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
/** 0 before a, 1 after b, linear between. */
export const ramp = (x: number, a: number, b: number) => clamp01((x - a) / (b - a))
export const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

/** Reads scroll progress from the track's position. */
export function readScroll() {
  const el = heroScroll.track
  if (!el) return
  const r = el.getBoundingClientRect()
  const travel = r.height - window.innerHeight
  heroScroll.raw = travel > 0 ? clamp01(-r.top / travel) : 0
}

/** Advances the damped progress (call once per frame). */
export function stepScroll(dt: number, damping: number, instant = false) {
  const k = instant ? 1 : 1 - Math.exp(-dt * damping)
  heroScroll.p += (heroScroll.raw - heroScroll.p) * k
  if (Math.abs(heroScroll.raw - heroScroll.p) < 1e-4) heroScroll.p = heroScroll.raw
}
