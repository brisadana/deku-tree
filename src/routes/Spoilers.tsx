import { Link } from 'react-router-dom'
import { spoilers } from '../content'

/** Lens of Truth page — built in M4. */
export default function Spoilers() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--deep)', padding: 'var(--gutter)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)' }}>{spoilers.title}</h1>
      <Link to="/">{spoilers.back}</Link>
    </main>
  )
}
