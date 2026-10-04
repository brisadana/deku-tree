import { useEffect, useRef } from 'react'
import { state } from '../lib/state'
import { beatAt, roomAt } from '../timeline/beats'

/** Dev-only readout of the scroll progress and current beat. */
export function DevProgress() {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      const p = state.progress
      const room = roomAt(p)
      if (el.current) el.current.textContent = `${(p * 100).toFixed(1)}% · ${beatAt(p)}${room >= 0 ? ' ' + (room + 1) : ''}`
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div
      ref={el}
      aria-hidden="true"
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        zIndex: 50,
        font: '12px/1 monospace',
        background: 'rgba(15,26,20,.7)',
        color: '#F2E6C9',
        padding: '6px 8px',
        borderRadius: 6,
      }}
    />
  )
}
