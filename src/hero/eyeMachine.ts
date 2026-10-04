import * as THREE from 'three'
import { heroConfig } from './hero.config'

/**
 * The tree's eyes as a small state machine. Pure logic, no rendering:
 * `stepEyes` advances it; Eyes.tsx reads `eyeState` into uniforms.
 *
 *   SLEEP ──(every 6–10 s)──► drowsy blink (part to ~0.15, hold, close) ──► SLEEP
 *   SLEEP / CLOSING ──(activity)──► WAKING ──(done)──► AWAKE
 *   AWAKE ──(idle ≥ idleBeforeSleep)──► CLOSING ──(done)──► SLEEP
 *
 * Every transition starts from the current openness, so nothing ever snaps.
 */
export type EyePhase = 'SLEEP' | 'WAKING' | 'AWAKE' | 'CLOSING'

type Tween = { from: number; to: number; dur: number; t: number; ease: (x: number) => number }

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3)
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const linear = (x: number) => x
const rand = (a: number, b: number) => a + Math.random() * (b - a)

export const eyeState = {
  state: 'SLEEP' as EyePhase,
  /** Lid openness 0 (closed) → 1 (open), before quick blinks. */
  open: 0,
  /** What is rendered: openness including quick blinks. */
  lids: 0,
  /** Emissive multiplier for the iris. */
  glow: 0,
  /** Pupil offset in eye space (-1..1 → ±pupilShift of the width). */
  pupil: new THREE.Vector2(),
  /** True after the first full wake (the overlay hint swaps then). */
  hasWoken: false,
  /** Seconds in the current state. */
  age: 0,
  // internals
  tween: null as Tween | null,
  drowsy: 0 as 0 | 1 | 2 | 3, // 0 none, 1 rising, 2 holding, 3 falling
  holdLeft: 0,
  nextDrowsy: 0,
  nextBlink: 0,
  blinkT: -1,
}

function tweenTo(to: number, dur: number, ease: Tween['ease']) {
  eyeState.tween = { from: eyeState.open, to, dur: Math.max(dur, 1e-3), t: 0, ease }
}

function enter(state: EyePhase) {
  const t = heroConfig.eyes.timing
  const reduced = eyeInput.reducedMotion
  eyeState.state = state
  eyeState.age = 0
  eyeState.drowsy = 0
  eyeState.blinkT = -1
  if (state === 'WAKING') tweenTo(1, t.wake * (1 - eyeState.open), reduced ? linear : easeOut)
  if (state === 'CLOSING') tweenTo(0, t.close * eyeState.open, reduced ? linear : easeInOut)
  if (state === 'SLEEP') {
    eyeState.tween = null
    eyeState.nextDrowsy = rand(t.drowsyEveryMin, t.drowsyEveryMax)
  }
  if (state === 'AWAKE') {
    eyeState.tween = null
    eyeState.hasWoken = true
    eyeState.nextBlink = rand(t.blinkEveryMin, t.blinkEveryMax)
  }
}

/** Inputs, written by the caller each frame. */
export const eyeInput = {
  /** Seconds since the last pointer move / touch / scroll. */
  inactiveFor: Infinity,
  /** Pointer position, -1..1. */
  ndc: new THREE.Vector2(),
  reducedMotion: false,
}

export function resetEyes() {
  eyeState.open = 0
  eyeState.hasWoken = false
  eyeState.pupil.set(0, 0)
  enter('SLEEP')
}
resetEyes()

/** Advances the eyes by dt seconds. */
export function stepEyes(dt: number) {
  const e = eyeState
  const c = heroConfig.eyes
  const t = c.timing
  const active = eyeInput.inactiveFor < Math.max(dt * 2, 0.05)
  e.age += dt

  // transitions driven by activity
  if (active && (e.state === 'SLEEP' || e.state === 'CLOSING')) enter('WAKING')
  if (e.state === 'AWAKE' && eyeInput.inactiveFor >= t.idleBeforeSleep) enter('CLOSING')
  if (e.state === 'WAKING' && !active && eyeInput.inactiveFor >= t.idleBeforeSleep) enter('CLOSING')

  // tween (wake / close)
  if (e.tween) {
    const w = e.tween
    w.t = Math.min(w.t + dt, w.dur)
    e.open = w.from + (w.to - w.from) * w.ease(w.t / w.dur)
    if (w.t >= w.dur) {
      e.tween = null
      if (e.state === 'WAKING') enter('AWAKE')
      else if (e.state === 'CLOSING') enter('SLEEP')
    }
  }

  // SLEEP: an occasional slow, drowsy blink
  if (e.state === 'SLEEP') {
    if (e.drowsy === 0) {
      e.nextDrowsy -= dt
      if (e.nextDrowsy <= 0) {
        e.drowsy = 1
        tweenTo(t.drowsyOpen, t.drowsyRise, easeInOut)
      }
    } else if (e.drowsy === 1 && !e.tween) {
      e.drowsy = 2
      e.holdLeft = t.drowsyHold
    } else if (e.drowsy === 2) {
      e.holdLeft -= dt
      if (e.holdLeft <= 0) {
        e.drowsy = 3
        tweenTo(0, t.drowsyFall, easeInOut)
      }
    } else if (e.drowsy === 3 && !e.tween) {
      e.drowsy = 0
      e.nextDrowsy = rand(t.drowsyEveryMin, t.drowsyEveryMax)
    }
  }

  // AWAKE: an occasional quick, normal blink (not with reduced motion)
  let blink = 0
  if (e.state === 'AWAKE' && !eyeInput.reducedMotion) {
    if (e.blinkT < 0) {
      e.nextBlink -= dt
      if (e.nextBlink <= 0) e.blinkT = 0
    } else {
      e.blinkT += dt
      blink = Math.sin(Math.min(e.blinkT / t.blink, 1) * Math.PI)
      if (e.blinkT >= t.blink) {
        e.blinkT = -1
        e.nextBlink = rand(t.blinkEveryMin, t.blinkEveryMax)
      }
    }
  }
  const lids = e.open * (1 - blink)
  e.lids = lids

  // glow follows the lids: faint while drowsy, full when awake
  const d = t.drowsyOpen
  e.glow = lids <= d ? c.drowsyGlow * (lids / d) : THREE.MathUtils.lerp(c.drowsyGlow, c.glow, (lids - d) / (1 - d))

  // pupils: centred while asleep / just waking, settle on the cursor when awake,
  // and keep their last gaze while the lids close
  if (e.state === 'CLOSING') return lids
  const tracking = !eyeInput.reducedMotion && (e.state === 'AWAKE' || (e.state === 'WAKING' && e.age > t.focusDelay))
  const tx = tracking ? THREE.MathUtils.clamp(eyeInput.ndc.x, -1, 1) : 0
  const ty = tracking ? THREE.MathUtils.clamp(eyeInput.ndc.y, -1, 1) * 0.5 : 0
  const k = 1 - Math.exp(-dt * c.pupilDamping)
  e.pupil.x += (tx - e.pupil.x) * k
  e.pupil.y += (ty - e.pupil.y) * k

  return lids
}
