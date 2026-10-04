import * as THREE from 'three'
import { placeholderAnchors } from './PlaceholderTree'

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/** Face anchors (tree space). Swapped for the real model's anchors in M5. */
export const FACE = placeholderAnchors

/** The hollow trunk interior lives far below the forest; only one of the two is visible at a time. */
export const DUNGEON = {
  center: v(0, -90, -12),
  radius: 20,
  floorY: -101.5,
}

export type RoomKind = 'sword' | 'shield' | 'slingshot' | 'gohma'

export const ROOMS: { pos: THREE.Vector3; kind: RoomKind }[] = [
  { pos: v(0, -100, 0), kind: 'sword' },
  { pos: v(10.5, -97, -12), kind: 'shield' },
  { pos: v(2, -91, -24), kind: 'slingshot' },
  { pos: v(-10.5, -100, -13), kind: 'gohma' },
]

/** Unit vector from a room toward the hollow's axis (where the camera stands). */
export function roomInward(pos: THREE.Vector3) {
  return new THREE.Vector3(DUNGEON.center.x - pos.x, 0, DUNGEON.center.z - pos.z).normalize()
}
