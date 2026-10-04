import * as THREE from 'three'
import { heroConfig } from './hero.config'

/*
 * The whole frame goes through ACES filmic tone mapping (in post). That curve
 * darkens and saturates flat colours, so a sky authored as #F5DFA6 would not
 * show as #F5DFA6. `sceneColor` runs three's ACES fit backwards, giving the
 * scene-linear value that lands on the authored display colour after tone
 * mapping. Used for unlit things whose colour must match exactly: sky, fog.
 */

// three's ACES matrices (column-major, as in tonemapping_pars_fragment)
const IN = new THREE.Matrix3().set(0.59719, 0.35458, 0.04823, 0.076, 0.90834, 0.01566, 0.0284, 0.13383, 0.83777)
const OUT = new THREE.Matrix3().set(1.60475, -0.53108, -0.07367, -0.10208, 1.10813, -0.00605, -0.00327, -0.07276, 1.07602)
const IN_INV = IN.clone().invert()
const OUT_INV = OUT.clone().invert()

/** Inverse of RRTAndODTFit for one channel (positive root of the quadratic). */
function invFit(y: number) {
  y = Math.min(Math.max(y, 0), 1.01)
  const a = 1 - 0.983729 * y
  const b = 0.0245786 - 0.432951 * y
  const c = -(0.000090537 + 0.238081 * y)
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
}

const v = new THREE.Vector3()

/** Display hex → scene-linear colour that tone-maps back to that hex. */
export function sceneColor(hex: THREE.ColorRepresentation, out = new THREE.Color(), exposure = heroConfig.renderer.exposure) {
  out.set(hex) // linear sRGB of the target
  v.set(out.r, out.g, out.b).applyMatrix3(OUT_INV)
  v.set(invFit(v.x), invFit(v.y), invFit(v.z)).applyMatrix3(IN_INV)
  v.multiplyScalar(0.6 / exposure)
  return out.setRGB(Math.max(v.x, 0), Math.max(v.y, 0), Math.max(v.z, 0))
}

/** GLSL twin of `sceneColor` for per-pixel use: display-linear colour → scene-linear (exposure via uniform). */
export const invAcesGLSL = /* glsl */ `
uniform float uExposure;
float invAcesFit(float y) {
  y = clamp(y, 0.0, 0.985);
  float a = 1.0 - 0.983729 * y;
  float b = 0.0245786 - 0.432951 * y;
  float c = -(0.000090537 + 0.238081 * y);
  return (-b + sqrt(b * b - 4.0 * a * c)) / (2.0 * a);
}
vec3 invAces(vec3 col) {
  // inverses of three's ACESOutputMat / ACESInputMat (column-major)
  const mat3 OUT_INV = mat3(${matGLSL(OUT_INV)});
  const mat3 IN_INV = mat3(${matGLSL(IN_INV)});
  vec3 u = OUT_INV * col;
  u = vec3(invAcesFit(u.x), invAcesFit(u.y), invAcesFit(u.z));
  return max(IN_INV * u, 0.0) * (0.6 / uExposure);
}
`

function matGLSL(m: THREE.Matrix3) {
  return Array.from(m.elements, (x) => x.toFixed(6)).join(', ')
}
