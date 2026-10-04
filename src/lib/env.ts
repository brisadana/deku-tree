const q = new URLSearchParams(window.location.search)

export const params = {
  record: q.get('record') === '1',
  ratio: q.get('ratio') as '4x5' | '16x9' | null,
  debug: q.get('debug') === '1',
}

const mq = (s: string) => window.matchMedia(s).matches

export const env = {
  isTouch: mq('(hover: none), (pointer: coarse)'),
  isMobile: mq('(max-width: 767px)'),
  reducedMotion: mq('(prefers-reduced-motion: reduce)'),
}
