import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { env } from '../lib/env'
import { state } from '../lib/state'

gsap.registerPlugin(ScrollTrigger)

let lenis: Lenis | null = null

/** Smooth-scrolls to a fraction of the story (or an element) using Lenis when available. */
export function scrollToProgress(p: number, opts: { immediate?: boolean; duration?: number } = {}) {
  const story = document.getElementById('story')
  if (!story) return
  const top = story.offsetTop + p * (story.offsetHeight - window.innerHeight)
  if (lenis && !opts.immediate) lenis.scrollTo(top, { duration: opts.duration ?? 2.2 })
  else window.scrollTo({ top, behavior: opts.immediate || env.reducedMotion ? 'auto' : 'smooth' })
}

export function getLenis() {
  return lenis
}

/**
 * Lenis smooth scroll synced to GSAP's ticker, plus one ScrollTrigger that maps
 * the #story element to state.progress (0..1). Everything else reads that value.
 */
export function useSmoothScroll() {
  useEffect(() => {
    if (!env.reducedMotion) {
      lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, touchMultiplier: 1.4 })
      lenis.on('scroll', ScrollTrigger.update)
    }
    const tick = (time: number) => lenis?.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    const st = ScrollTrigger.create({
      trigger: '#story',
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        state.progress = self.progress
      },
    })
    state.progress = st.progress

    return () => {
      st.kill()
      gsap.ticker.remove(tick)
      lenis?.destroy()
      lenis = null
    }
  }, [])
}
