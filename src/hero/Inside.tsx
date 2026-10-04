import { inside } from '../content'
import styles from './Inside.module.css'

/** The section the visitor lands in after entering the tree: same dark tone as the veil. */
export function Inside() {
  return (
    <section id="inside" className={styles.inside} aria-labelledby="inside-title">
      <div className={styles.inner}>
        <p className={styles.eyebrow}>{inside.eyebrow}</p>
        <h2 id="inside-title" className={styles.title}>
          {inside.title}
        </h2>
        <p className={styles.body}>{inside.body}</p>
      </div>
    </section>
  )
}
