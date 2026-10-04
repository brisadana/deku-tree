import * as THREE from 'three'

/** TubeGeometry whose radius tapers from r0 to r1 along the curve. */
export function taperedTube(
  curve: THREE.Curve<THREE.Vector3>,
  r0: number,
  r1: number,
  tubular = 24,
  radial = 10,
) {
  const g = new THREE.TubeGeometry(curve, tubular, 1, radial, false)
  const pos = g.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let j = 0; j <= tubular; j++) {
    const t = j / tubular
    curve.getPointAt(t, c)
    const r = THREE.MathUtils.lerp(r0, r1, t)
    for (let i = 0; i <= radial; i++) {
      const k = j * (radial + 1) + i
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c)
      pos.setXYZ(k, v.x, v.y, v.z)
    }
  }
  g.computeVertexNormals()
  return g
}

/** Cheap deterministic 3D noise for CPU-side geometry displacement. */
export function n3(x: number, y: number, z: number) {
  return (
    Math.sin(x * 1.7 + Math.sin(y * 1.3) * 1.1) * 0.5 +
    Math.sin(y * 2.3 + Math.sin(z * 1.9) * 1.2) * 0.3 +
    Math.sin(z * 2.9 + Math.sin(x * 2.1) * 0.9) * 0.2
  )
}

/** Paints a vertex-color attribute from a per-vertex callback. */
export function paint(g: THREE.BufferGeometry, fn: (p: THREE.Vector3, out: THREE.Color) => void) {
  const pos = g.attributes.position
  const col = new Float32Array(pos.count * 3)
  const p = new THREE.Vector3()
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    fn(p, c)
    col.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}
