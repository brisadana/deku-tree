import { useMemo } from 'react'
import * as THREE from 'three'
import { noiseGLSL } from '../shaders/noise'
import { GROUND } from './palette'

/** Shared GLSL for the ground/grass color field so blades sit on matching soil. */
export const fieldGLSL = /* glsl */ `
${noiseGLSL}
uniform vec3 uGBase, uGDark, uGLight;
vec3 fieldColor(vec2 xz) {
  float n = fbm(xz * 0.09);
  float n2 = fbm(xz * 0.35 + 7.0);
  vec3 c = mix(uGDark, uGBase, smoothstep(0.25, 0.6, n));
  c = mix(c, uGLight, smoothstep(0.62, 0.8, n2) * 0.45);
  // soft contact shadow under the canopy
  float r = length(xz - vec2(0.0, 0.5));
  c *= mix(0.55, 1.0, smoothstep(3.0, 11.0, r));
  return c;
}
`

export const fieldUniforms = {
  uGBase: { value: GROUND.base },
  uGDark: { value: GROUND.dark },
  uGLight: { value: GROUND.light },
}

export function Ground() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        fog: true,
        uniforms: { ...THREE.UniformsLib.fog, ...fieldUniforms },
        vertexShader: /* glsl */ `
          varying vec2 vXZ;
          #include <fog_pars_vertex>
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vXZ = wp.xz;
            vec4 mvPosition = viewMatrix * wp;
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }
        `,
        fragmentShader: /* glsl */ `
          ${fieldGLSL}
          varying vec2 vXZ;
          #include <fog_pars_fragment>
          void main() {
            vec3 c = fieldColor(vXZ);
            gl_FragColor = vec4(mix(c, vec3(0.30, 0.48, 0.30), 0.45), 1.0);
            #include <colorspace_fragment>
            #include <fog_fragment>
          }
        `,
      }),
    [],
  )
  return (
    <mesh material={material} rotation-x={-Math.PI / 2} renderOrder={-5}>
      <planeGeometry args={[600, 600, 1, 1]} />
    </mesh>
  )
}
