import { useMemo } from 'react'
import * as THREE from 'three'
import { useForest } from './useModels'

/**
 * A height + "dirt" grid over the clearing, rasterised once from the Ground mesh.
 * Heights come from the triangles; dirt comes from the ground texture (the painted
 * path is brown), so grass avoids exactly the path the visitor sees.
 * Coordinates are the world group's local space (the forest sits at the origin).
 */
export type GroundField = {
  extent: number
  cell: number
  n: number
  heights: Float32Array
  dirt: Float32Array
  /** Ground height at x,z (NaN outside the mesh). */
  height(x: number, z: number): number
  /** 0 = grass, 1 = bare path. */
  dirtAt(x: number, z: number): number
}

const cache = new WeakMap<THREE.Object3D, GroundField>()

export function useGroundField(extent = 42, cell = 0.2) {
  const { scene } = useForest()
  return useMemo(() => {
    const hit = cache.get(scene)
    if (hit) return hit
    const ground = scene.getObjectByName('Ground') as THREE.Mesh
    const field = buildGroundField(ground, extent, cell)
    cache.set(scene, field)
    return field
  }, [scene, extent, cell])
}

function textureSampler(mesh: THREE.Mesh) {
  const map = (mesh.material as THREE.MeshStandardMaterial).map
  const img = map?.image as CanvasImageSource | undefined
  if (!img) return null
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  // glTF textures are not flipped (flipY = false): uv (0,0) is the image's top-left
  ctx.drawImage(img, 0, 0, size, size)
  const data = ctx.getImageData(0, 0, size, size).data
  return (u: number, v: number) => {
    const x = Math.min(size - 1, Math.max(0, Math.floor(u * size)))
    const y = Math.min(size - 1, Math.max(0, Math.floor(v * size)))
    const i = (y * size + x) * 4
    return [data[i], data[i + 1], data[i + 2]] as const
  }
}

export function buildGroundField(mesh: THREE.Mesh, extent: number, cell: number): GroundField {
  const n = Math.ceil((extent * 2) / cell)
  const heights = new Float32Array(n * n).fill(NaN)
  const us = new Float32Array(n * n)
  const vs = new Float32Array(n * n)
  const g = mesh.geometry
  const pos = g.attributes.position
  const uv = g.attributes.uv
  const index = g.index
  const triCount = index ? index.count / 3 : pos.count / 3
  const at = (k: number) => (index ? index.getX(k) : k)
  mesh.updateMatrixWorld(true)
  const m = mesh.matrixWorld
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()

  for (let t = 0; t < triCount; t++) {
    const ia = at(t * 3)
    const ib = at(t * 3 + 1)
    const ic = at(t * 3 + 2)
    a.fromBufferAttribute(pos, ia).applyMatrix4(m)
    b.fromBufferAttribute(pos, ib).applyMatrix4(m)
    c.fromBufferAttribute(pos, ic).applyMatrix4(m)
    const minX = Math.max(0, Math.floor((Math.min(a.x, b.x, c.x) + extent) / cell))
    const maxX = Math.min(n - 1, Math.ceil((Math.max(a.x, b.x, c.x) + extent) / cell))
    const minZ = Math.max(0, Math.floor((Math.min(a.z, b.z, c.z) + extent) / cell))
    const maxZ = Math.min(n - 1, Math.ceil((Math.max(a.z, b.z, c.z) + extent) / cell))
    if (minX > maxX || minZ > maxZ) continue
    const det = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z)
    if (Math.abs(det) < 1e-9) continue
    for (let gz = minZ; gz <= maxZ; gz++) {
      const z = gz * cell - extent + cell / 2
      for (let gx = minX; gx <= maxX; gx++) {
        const x = gx * cell - extent + cell / 2
        const w1 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / det
        const w2 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / det
        const w3 = 1 - w1 - w2
        if (w1 < -1e-4 || w2 < -1e-4 || w3 < -1e-4) continue
        const y = w1 * a.y + w2 * b.y + w3 * c.y
        const k = gz * n + gx
        if (!(heights[k] >= y)) {
          heights[k] = y
          us[k] = w1 * uv.getX(ia) + w2 * uv.getX(ib) + w3 * uv.getX(ic)
          vs[k] = w1 * uv.getY(ia) + w2 * uv.getY(ib) + w3 * uv.getY(ic)
        }
      }
    }
  }

  // dirt from the texture: brown (red ≥ green) reads as path
  const dirt = new Float32Array(n * n)
  const sample = textureSampler(mesh)
  if (sample) {
    for (let k = 0; k < n * n; k++) {
      if (Number.isNaN(heights[k])) continue
      const [r, gr, bl] = sample(us[k], vs[k])
      const warm = (r - gr) / 255 + (r - bl) / 255 * 0.15
      dirt[k] = THREE.MathUtils.smoothstep(warm, -0.06, 0.04)
    }
    // soften the edge a little so blades thin out toward the path
    for (let pass = 0; pass < 3; pass++) {
      const soft = dirt.slice()
      for (let z = 1; z < n - 1; z++)
        for (let x = 1; x < n - 1; x++) {
          const k = z * n + x
          soft[k] = Math.max(dirt[k], (dirt[k - 1] + dirt[k + 1] + dirt[k - n] + dirt[k + n]) * 0.25)
        }
      dirt.set(soft)
    }
  }

  const idx = (x: number, z: number) => {
    const gx = Math.floor((x + extent) / cell)
    const gz = Math.floor((z + extent) / cell)
    if (gx < 0 || gz < 0 || gx >= n || gz >= n) return -1
    return gz * n + gx
  }
  return {
    extent,
    cell,
    n,
    heights,
    dirt,
    height: (x, z) => {
      const k = idx(x, z)
      return k < 0 ? NaN : heights[k]
    },
    dirtAt: (x, z) => {
      const k = idx(x, z)
      return k < 0 ? 1 : dirt[k]
    },
  }
}

/**
 * Top-down footprint of the tree's roots and trunk on the ground grid (0 = free, 1 = covered),
 * rasterised from every tree triangle that reaches below `maxY` metres, plus a soft fringe.
 * `space` is the object whose local frame the grid uses (the world group).
 */
export function buildTreeFootprint(field: GroundField, model: THREE.Object3D, space: THREE.Object3D, maxY = 2.5) {
  const { n, cell, extent } = field
  const foot = new Float32Array(n * n)
  space.updateMatrixWorld(true)
  const spaceInv = space.matrixWorld.clone().invert()
  const rel = new THREE.Matrix4()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const mark = (x: number, z: number) => {
    const gx = Math.floor((x + extent) / cell)
    const gz = Math.floor((z + extent) / cell)
    if (gx >= 0 && gz >= 0 && gx < n && gz < n) foot[gz * n + gx] = 1
  }
  model.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    rel.multiplyMatrices(spaceInv, mesh.matrixWorld)
    const pos = mesh.geometry.attributes.position
    const index = mesh.geometry.index
    const count = index ? index.count : pos.count
    for (let k = 0; k < count; k += 3) {
      const ia = index ? index.getX(k) : k
      const ib = index ? index.getX(k + 1) : k + 1
      const ic = index ? index.getX(k + 2) : k + 2
      a.fromBufferAttribute(pos, ia).applyMatrix4(rel)
      b.fromBufferAttribute(pos, ib).applyMatrix4(rel)
      c.fromBufferAttribute(pos, ic).applyMatrix4(rel)
      if (Math.min(a.y, b.y, c.y) > maxY) continue
      // sample the triangle densely (also catches near-vertical walls)
      const span = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a))
      const steps = Math.max(1, Math.ceil(span / (cell * 0.7)))
      for (let i = 0; i <= steps; i++)
        for (let j = 0; j <= steps - i; j++) {
          const u = i / steps
          const v = j / steps
          const w = 1 - u - v
          mark(a.x * w + b.x * u + c.x * v, a.z * w + b.z * u + c.z * v)
        }
    }
  })
  // fill enclosed holes (inside the trunk shell): flood the outside, everything unreached is covered
  const outside = new Uint8Array(n * n)
  const stack: number[] = [0]
  outside[0] = 1
  while (stack.length) {
    const k = stack.pop()!
    const x = k % n
    const z = (k / n) | 0
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx
      const nz = z + dz
      if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue
      const q = nz * n + nx
      if (outside[q] || foot[q] >= 1) continue
      outside[q] = 1
      stack.push(q)
    }
  }
  for (let k = 0; k < n * n; k++) if (!outside[k]) foot[k] = 1
  // soft fringe so blades thin out and shorten against the roots
  for (let pass = 0; pass < 3; pass++) {
    const soft = foot.slice()
    for (let z = 1; z < n - 1; z++)
      for (let x = 1; x < n - 1; x++) {
        const k = z * n + x
        soft[k] = Math.max(foot[k], (foot[k - 1] + foot[k + 1] + foot[k - n] + foot[k + n]) * 0.25)
      }
    foot.set(soft)
  }
  return foot
}
