import { lazy, Suspense } from 'react'
import { Hero } from '../hero/Hero'
import { params } from '../lib/env'

/** Previous scroll-driven experience (beats 2–7), kept intact behind ?story=1 and loaded only then. */
const Story = lazy(() => import('./Story'))

export default function Home() {
  return params.story ? (
    <Suspense fallback={null}>
      <Story />
    </Suspense>
  ) : (
    <Hero />
  )
}
