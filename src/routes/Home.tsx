import { Experience } from '../scene/Experience'
import { ANCHORS, STORY_VH } from '../timeline/beats'
import { useSmoothScroll } from '../timeline/useSmoothScroll'
import { DevProgress } from '../ui/DevProgress'
import { params } from '../lib/env'
import styles from './Home.module.css'

export default function Home() {
  useSmoothScroll()
  return (
    <>
      <Experience />
      <div id="wipe" className={styles.wipe} aria-hidden="true" />
      <main id="story" className={styles.story} style={{ height: `${STORY_VH}vh` }}>
        {ANCHORS.map((a) => (
          <span
            key={a.id}
            id={a.id}
            className={styles.anchor}
            style={{ top: `${a.at * (STORY_VH - 100)}vh` }}
          />
        ))}
      </main>
      {import.meta.env.DEV && !params.record && <DevProgress />}
    </>
  )
}
