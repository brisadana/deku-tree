import { useMemo } from 'react'
import * as THREE from 'three'
import { noiseGLSL } from '../shaders/noise'

/**
 * Painted forest silhouettes on two cylindrical bands far behind the tree.
 * Gives the horizon depth without real geometry; colors melt into the fog.
 */
export function Treeline() {
  const bands = useMemo(
    () =>
      [
        { radius: 70, height: 16, color: '#5B8A6A', seed: 1.0, top: 0.5 },
        { radius: 105, height: 26, color: '#9DBB98', seed: 7.0, top: 0.55 },
      ].map(({ radius, height, color, seed, top }) => {
        const geo = new THREE.CylinderGeometry(radius, radius, height, 128, 1, true)
        geo.translate(0, height / 2 - 1, 0)
        const mat = new THREE.ShaderMaterial({
          side: THREE.BackSide,
          transparent: true,
          fog: true,
          uniforms: {
            ...THREE.UniformsLib.fog,
            uColor: { value: new THREE.Color(color) },
            uSeed: { value: seed },
            uTop: { value: top },
          },
          vertexShader: /* glsl */ `
            varying vec2 vUv;
            #include <fog_pars_vertex>
            void main() {
              vUv = uv;
              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
              gl_Position = projectionMatrix * mvPosition;
              #include <fog_vertex>
            }
          `,
          fragmentShader: /* glsl */ `
            ${noiseGLSL}
            uniform vec3 uColor;
            uniform float uSeed, uTop;
            varying vec2 vUv;
            #include <fog_pars_fragment>
            void main() {
              float x = vUv.x * 90.0;
              // rounded crowns: bumps of varying size
              float crowns = abs(sin(x * 0.9 + uSeed)) * 0.08 + abs(sin(x * 2.3 + uSeed * 3.0)) * 0.05;
              float edge = uTop * (0.75 + fbm(vec2(x * 0.15, uSeed)) * 0.5) + crowns;
              if (vUv.y > edge) discard;
              float shade = mix(0.82, 1.0, smoothstep(edge - 0.25, edge, vUv.y));
              gl_FragColor = vec4(uColor * shade, 1.0);
              #include <colorspace_fragment>
              #include <fog_fragment>
            }
          `,
        })
        return { geo, mat }
      }),
    [],
  )
  return (
    <group>
      {bands.map((b, i) => (
        <mesh key={i} geometry={b.geo} material={b.mat} renderOrder={-8} />
      ))}
    </group>
  )
}
