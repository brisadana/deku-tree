import * as THREE from 'three'
import { noiseGLSL } from './noise'
import { treeDeformGLSL } from './treeDeform'
import { U } from '../scene/uniforms'

let gradient: THREE.DataTexture | null = null

/** 4-band light ramp for MeshToonMaterial. */
export function toonGradient() {
  if (gradient) return gradient
  const bands = [70, 135, 200, 255]
  const data = new Uint8Array(bands.length * 4)
  bands.forEach((v, i) => data.set([v, v, v, 255], i * 4))
  gradient = new THREE.DataTexture(data, bands.length, 1, THREE.RGBAFormat)
  gradient.minFilter = THREE.NearestFilter
  gradient.magFilter = THREE.NearestFilter
  gradient.generateMipmaps = false
  gradient.needsUpdate = true
  return gradient
}

const curseUniforms = {
  uCurseColor: { value: new THREE.Color('#6B3FA0') },
  uCurseDark: { value: new THREE.Color('#2A1840') },
  uCurseEdge: { value: new THREE.Color('#C08CFF') },
}

/** Curse mask: climbs from the roots (y=0) to the canopy as uCurse goes 0 → 1. */
const curseFragGLSL = /* glsl */ `
  ${noiseGLSL}
  uniform float uCurse;
  uniform vec3 uCurseColor, uCurseDark, uCurseEdge;
  varying vec3 vTreePos;
  float curseFront() { return uCurse * 14.0 - 1.5; }
  float curseHeight() {
    float n = fbm(vTreePos.xz * 0.7 + vTreePos.y * 0.25);
    return vTreePos.y + (n - 0.5) * 3.0;
  }
`

type ToonOpts = THREE.MeshToonMaterialParameters & { deform?: boolean; curse?: boolean }

/** Toon material; with `deform` it shares the tree's breath/wind motion, with `curse` the purple corruption. */
export function makeToon({ deform = false, curse = false, ...params }: ToonOpts = {}) {
  const m = new THREE.MeshToonMaterial({ gradientMap: toonGradient(), ...params })
  if (deform || curse) {
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        uTime: U.uTime,
        uBreath: U.uBreath,
        uWind: U.uWind,
        uCurse: U.uCurse,
        ...curseUniforms,
      })
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${treeDeformGLSL}\nvarying vec3 vTreePos;`)
        .replace(
          '#include <begin_vertex>',
          `vec3 transformed = ${deform ? 'treeDeform(vec3(position))' : 'vec3(position)'};\nvTreePos = position;`,
        )
      if (curse) {
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>\n${curseFragGLSL}`)
          .replace(
            '#include <color_fragment>',
            /* glsl */ `#include <color_fragment>
            float cf = curseFront();
            float ch = curseHeight();
            float cm = 1.0 - smoothstep(cf - 0.5, cf, ch);
            float veins = smoothstep(0.43, 0.49, abs(fract(fbm(vTreePos.xy * 1.6 + vTreePos.zy * 0.8) * 5.0) - 0.5));
            diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb * vec3(0.42, 0.36, 0.5), uCurseColor, veins * 0.85), cm);`,
          )
          .replace(
            '#include <emissivemap_fragment>',
            /* glsl */ `#include <emissivemap_fragment>
            float cEdge = smoothstep(cf - 0.7, cf - 0.25, ch) * (1.0 - smoothstep(cf - 0.25, cf, ch));
            totalEmissiveRadiance += uCurseEdge * cEdge * 1.4 * step(0.001, uCurse) + uCurseColor * veins * cm * 0.35;`,
          )
      }
    }
    m.customProgramCacheKey = () => `toon-tree-${deform}-${curse}`
  }
  return m
}
