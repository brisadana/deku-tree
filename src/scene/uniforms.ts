import * as THREE from 'three'

/**
 * Uniforms shared by reference across every material that needs them,
 * so one update per frame drives the whole scene.
 */
export const U = {
  uTime: { value: 0 },
  /** Trunk breathing amount 0..1. */
  uBreath: { value: 1 },
  /** Canopy wind amount 0..1. */
  uWind: { value: 1 },
  /** Curse coverage 0..1 (roots upward). */
  uCurse: { value: 0 },
  /** Sun direction (world, normalized). */
  uSunDir: { value: new THREE.Vector3(-0.45, 0.62, 0.64).normalize() },
}

/** Tree-space constants. The placeholder and the real model are both normalized to this height. */
export const TREE_HEIGHT = 17

/**
 * Beat-driven values written once per frame by the Director and read by
 * scene components. Plain numbers, no React state.
 */
export const fx = {
  /** 0 = forest visible, 1 = inside the tree. */
  inside: 0,
  /** Mouth opening 0..1. */
  maw: 0,
  /** Purple glow in the dungeon roots 0..1. */
  rootGlow: 1,
  /** Queen Gohma presence 0..1 (fades when the curse breaks). */
  gohma: 1,
  /** Emerald rise 0..1. */
  emerald: 0,
  /** Black radial wipe: 0 = open, 1 = fully closed. */
  wipe: 0,
  /** Seconds-based time for prop spins (pauses nothing). */
  spin: 0,
}
