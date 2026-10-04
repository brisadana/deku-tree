import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { hero } from '../content'
import { eyeState } from './eyeMachine'
import { HU } from './uniforms'
import styles from './Overlay.module.css'

/**
 * Minimal type over the 3D: wordmark, two quiet controls, the title and a hint.
 * Fades in once the tree has started to appear; the hint swaps after the first wake.
 */
export function Overlay() {
  const [ready, setReady] = useState(false)
  const [woken, setWoken] = useState(false)
  const [sound, setSound] = useState(false)

  // watch the frame-loop state without re-rendering every frame: flip once, then stop
  useEffect(() => {
    let raf = 0
    const tick = () => {
      if (!ready && HU.uReveal.value > 0.35) setReady(true)
      if (!woken && eyeState.hasWoken) setWoken(true)
      if (!(ready && woken)) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ready, woken])

  return (
    <div className={styles.overlay} data-ready={ready}>
      <div className={styles.scrim} aria-hidden="true" />
      <header className={styles.top}>
        <p className={styles.wordmark}>{hero.wordmark}</p>
        <nav className={styles.nav} aria-label="Site">
          <Link to="/spoilers" className={styles.ui}>
            {hero.spoilers}
          </Link>
          <button type="button" className={styles.ui} aria-pressed={sound} onClick={() => setSound((s) => !s)}>
            {hero.sound} · {sound ? hero.soundOn : hero.soundOff}
          </button>
        </nav>
      </header>
      <div className={styles.bottom}>
        <h1 className={styles.title}>{hero.title}</h1>
        <p className={styles.hint} aria-live="polite">
          <span className={styles.hintText} data-show={!woken} aria-hidden={woken}>
            {hero.hintWake}
          </span>
          <span className={styles.hintText} data-show={woken} aria-hidden={!woken}>
            {hero.hintEnter}
          </span>
        </p>
      </div>
    </div>
  )
}
