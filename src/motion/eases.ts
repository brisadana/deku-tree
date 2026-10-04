import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(CustomEase)

/** The only three eases used in the project. */
export const EASE = {
  /** Text and UI reveals. */
  reveal: 'power3.out',
  /** Camera flights and large transitions. */
  camera: 'expo.inOut',
  /** Breathing loop and eyelids: soft in, long soft out. */
  organic: CustomEase.create('organic', 'M0,0 C0.37,0 0.24,1 1,1'),
} as const

/** JS-side equivalent of EASE.organic for per-frame math (smootherstep). */
export const organic01 = (t: number) => {
  const x = Math.min(1, Math.max(0, t))
  return x * x * x * (x * (x * 6 - 15) + 10)
}
