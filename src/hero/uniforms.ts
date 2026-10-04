import * as THREE from 'three'

/** Uniforms shared by reference across hero materials; one update per frame drives them all. */
export const HU = {
  uTime: { value: 0 },
  /** Entrance: sky brightness 0 → 1 (black to sky). */
  uSkyReveal: { value: 0 },
  /** Entrance: world brightness 0 → 1, starts after the sky. */
  uReveal: { value: 0 },
}

/** GLSL multiplied in at the very end of every patched world material. */
const REVEAL_FRAG = 'gl_FragColor.rgb *= uReveal;'

/**
 * Patches a built-in material: `head` goes before main() in the vertex shader,
 * `body` after <begin_vertex> (edit `transformed`, world-space helpers are up to you).
 * Every patched material also fades with the entrance reveal.
 */
export function patchMaterial(
  material: THREE.Material,
  key: string,
  uniforms: Record<string, THREE.IUniform> = {},
  head = '',
  body = '',
) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, { uReveal: HU.uReveal })
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `${head}\nvoid main() {`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${body}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uReveal;\nvoid main() {')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>\n${REVEAL_FRAG}`)
  }
  material.customProgramCacheKey = () => key
  material.needsUpdate = true
}
