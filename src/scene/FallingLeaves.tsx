import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { env } from '../lib/env'
import { makeLeafTexture, rng } from './textures'
import { U } from './uniforms'

/** 0..1 multiplier on fall speed; the timeline eases it to 0 to "pause" the leaves. */
export const leafUniforms = {
  uLeafTime: { value: 0 },
  uLeafSpeed: { value: 1 },
}

export function FallingLeaves({ count = env.isMobile ? 28 : 70 }) {
  const geometry = useMemo(() => {
    const quad = new THREE.PlaneGeometry(0.32, 0.32)
    const g = new THREE.InstancedBufferGeometry()
    g.index = quad.index
    g.attributes.position = quad.attributes.position
    g.attributes.uv = quad.attributes.uv
    const r = rng(42)
    const start = new Float32Array(count * 3)
    const seed = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      start.set([(r() - 0.5) * 22, 0, -4 + r() * 18], i * 3)
      seed.set([r(), r(), r(), r()], i * 4)
    }
    g.setAttribute('aStart', new THREE.InstancedBufferAttribute(start, 3))
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4))
    g.instanceCount = count
    return g
  }, [count])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        fog: true,
        uniforms: {
          ...THREE.UniformsLib.fog,
          ...leafUniforms,
          uSunDir: U.uSunDir,
          uMap: { value: makeLeafTexture() },
          uA: { value: new THREE.Color('#3E7A57') },
          uB: { value: new THREE.Color('#9CC88F') },
          uGold: { value: new THREE.Color('#E8C766') },
        },
        vertexShader: /* glsl */ `
          attribute vec3 aStart;
          attribute vec4 aSeed;
          uniform float uLeafTime;
          varying vec2 vUv;
          varying float vShade;
          varying float vSeed;
          #include <fog_pars_vertex>

          vec3 rotAxis(vec3 v, vec3 k, float a) {
            float c = cos(a), s = sin(a);
            return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
          }

          void main() {
            float fallH = 17.0;
            float t = uLeafTime * (0.55 + aSeed.x * 0.5) + aSeed.y * 40.0;
            float y = fallH - mod(t * 0.9, fallH);
            vec3 c = vec3(
              aStart.x + sin(t * 0.8 + aSeed.z * 6.28) * 1.3,
              y,
              aStart.z + cos(t * 0.6 + aSeed.w * 6.28) * 0.9
            );
            vec3 axis = normalize(vec3(aSeed.z - 0.5, 0.6, aSeed.w - 0.5));
            float ang = t * (1.4 + aSeed.x) + aSeed.w * 6.28;
            vec3 local = rotAxis(position, axis, ang);
            vec3 n = rotAxis(vec3(0.0, 0.0, 1.0), axis, ang);
            float scale = smoothstep(0.05, 0.8, y) * (0.8 + aSeed.z * 0.6);
            vec3 world = c + local * scale;
            vUv = uv;
            vShade = abs(n.y) * 0.6 + 0.4;
            vSeed = aSeed.x;
            vec4 mvPosition = viewMatrix * vec4(world, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap;
          uniform vec3 uA, uB, uGold;
          varying vec2 vUv;
          varying float vShade;
          varying float vSeed;
          #include <fog_pars_fragment>
          void main() {
            vec4 t = texture2D(uMap, vUv);
            if (t.a < 0.5) discard;
            vec3 col = mix(uA, uB, step(0.55, vShade));
            col = mix(col, uGold, step(0.8, vSeed) * 0.8);
            col *= 1.0 - (1.0 - t.r) * 0.6;
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
            #include <fog_fragment>
          }
        `,
      }),
    [],
  )

  useFrame((_, dt) => {
    leafUniforms.uLeafTime.value += Math.min(dt, 0.05) * leafUniforms.uLeafSpeed.value
  })

  return <mesh geometry={geometry} material={material} frustumCulled={false} />
}
