import * as THREE from 'three'

const c = (hex: string) => new THREE.Color(hex)

/** Sky / atmosphere presets. `day` = hero, `dusk` = curse. */
export const SKY = {
  day: {
    zenith: c('#7FB6C2'),
    mid: c('#CFE3C4'),
    horizon: c('#F5DFA6'),
    sun: c('#FFE2A0'),
    cloud: c('#FFF4DA'),
  },
  dusk: {
    zenith: c('#2B2A52'),
    mid: c('#6B4F86'),
    horizon: c('#D59A7A'),
    sun: c('#F0A070'),
    cloud: c('#B98FB0'),
  },
}

export const GROUND = {
  base: c('#2E5A40'),
  dark: c('#1B3A2E'),
  light: c('#4A7F52'),
}
