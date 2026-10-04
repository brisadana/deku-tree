import { useMemo } from 'react'
import * as THREE from 'three'
import { noiseGLSL } from '../shaders/noise'
import { SKY } from './palette'
import { U } from './uniforms'

export const skyUniforms = {
  uZenith: { value: SKY.day.zenith.clone() },
  uMid: { value: SKY.day.mid.clone() },
  uHorizon: { value: SKY.day.horizon.clone() },
  uSun: { value: SKY.day.sun.clone() },
  uCloud: { value: SKY.day.cloud.clone() },
}

/** Painted gradient sky dome with soft brush-like cloud streaks. */
export function Sky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { ...skyUniforms, uTime: U.uTime, uSunDir: U.uSunDir },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = p.xyww;
          }
        `,
        fragmentShader: /* glsl */ `
          ${noiseGLSL}
          uniform vec3 uZenith, uMid, uHorizon, uSun, uCloud, uSunDir;
          uniform float uTime;
          varying vec3 vDir;
          void main() {
            vec3 d = normalize(vDir);
            float az = atan(d.z, d.x);
            float h = d.y + (fbm(vec2(az * 2.0, d.y * 3.0)) - 0.5) * 0.05;
            vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
            col = mix(col, uZenith, smoothstep(0.18, 0.75, h));

            // brush-stroke clouds: stretched noise in a band above the horizon
            float cl = fbm(vec2(az * 3.5 + uTime * 0.004, d.y * 14.0));
            cl *= fbm(vec2(az * 9.0 - uTime * 0.003, d.y * 30.0) + 4.0) * 1.4;
            float band = smoothstep(0.04, 0.14, d.y) * (1.0 - smoothstep(0.32, 0.55, d.y));
            col = mix(col, uCloud, smoothstep(0.42, 0.62, cl) * band * 0.75);

            float s = max(dot(d, normalize(uSunDir)), 0.0);
            col += uSun * (pow(s, 6.0) * 0.28 + pow(s, 48.0) * 0.6);

            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
      }),
    [],
  )
  return (
    <mesh material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[500, 32, 16]} />
    </mesh>
  )
}
