import { useFrame } from '@react-three/fiber'
import { forwardRef, useMemo } from 'react'
import * as THREE from 'three'
import { noiseGLSL } from '../shaders/noise'
import { invAcesGLSL } from './color'
import { heroConfig } from './hero.config'
import { HU } from './uniforms'

const vertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position.z = gl_Position.w; // always at the far plane
}
`

const fragment = /* glsl */ `
uniform float uTime;
uniform float uReveal;
uniform vec3 uHorizon, uMid, uZenith, uSunColor, uCloud, uCloudShade;
uniform vec3 uSunDir;
uniform float uMidHeight, uZenithHeight, uZenithPower;
uniform float uHaloPow, uHalo, uCorePow, uCore, uSunHdr;
uniform vec4 uCloudA, uCloudB; // scale, speed, coverage, softness
uniform vec2 uCloudOpacity;
uniform vec2 uCloudBand;
varying vec3 vDir;
${noiseGLSL}
${invAcesGLSL}

float cloudLayer(vec3 d, vec4 p, float seed) {
  // project onto a high dome so clouds flatten toward the horizon
  vec2 uv = d.xz / (d.y + 0.18);
  uv = uv * p.x + vec2(uTime * p.y, seed);
  // domain warp for painterly, smeared shapes
  vec2 w = vec2(fbm(uv * 0.7 + seed), fbm(uv * 0.7 - seed + 3.1));
  float n = fbm(uv + (w - 0.5) * 1.4);
  return smoothstep(p.z - p.w, p.z + p.w, n);
}

void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0.0, 1.0);

  // painted gradient: golden horizon -> sage -> teal zenith
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, uMidHeight, h));
  col = mix(col, uZenith, pow(smoothstep(uMidHeight * 0.6, uZenithHeight, h), uZenithPower));

  // soft sun: a wide warm halo (mixed like paint) plus an HDR core that alone reaches bloom
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  float halo = pow(s, uHaloPow) * uHalo;
  float core = pow(s, uCorePow) * uCore;

  // two drifting cloud layers, low contrast
  float band = smoothstep(uCloudBand.x, uCloudBand.x + 0.12, h) * (1.0 - smoothstep(uCloudBand.y - 0.25, uCloudBand.y, h));
  float far = cloudLayer(d, uCloudB, 7.3) * uCloudOpacity.y * band;
  float near = cloudLayer(d, uCloudA, 1.7) * uCloudOpacity.x * band;
  vec3 cloudCol = mix(uCloudShade, uCloud, 0.4 + 0.6 * pow(s, 3.0));
  col = mix(col, cloudCol, far);
  col = mix(col, uSunColor, clamp(halo + core, 0.0, 1.0) * (1.0 - 0.5 * near));
  col = mix(col, cloudCol, near);

  // authored in display space -> scene-linear, so ACES lands back on these colours
  vec3 sceneCol = invAces(col) + uSunColor * core * uSunHdr * (1.0 - near);
  gl_FragColor = vec4(sceneCol * uReveal, 1.0);
}
`

type CloudCfg = (typeof heroConfig.sky.clouds)[number]
const cloudVec = (c: CloudCfg, out: THREE.Vector4) => out.set(c.scale, c.speed, c.coverage, c.softness)

/** Inverted dome with a painted gradient, soft sun glow and two fbm cloud layers. */
export const Sky = forwardRef<THREE.Mesh>(function Sky(_, ref) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTime: HU.uTime,
          uExposure: { value: 1 },
          uReveal: HU.uSkyReveal,
          uHorizon: { value: new THREE.Color() },
          uMid: { value: new THREE.Color() },
          uZenith: { value: new THREE.Color() },
          uSunColor: { value: new THREE.Color() },
          uCloud: { value: new THREE.Color() },
          uCloudShade: { value: new THREE.Color() },
          uSunDir: { value: new THREE.Vector3() },
          uMidHeight: { value: 0 },
          uZenithHeight: { value: 1 },
          uZenithPower: { value: 1 },
          uHaloPow: { value: 1 },
          uHalo: { value: 0 },
          uCorePow: { value: 1 },
          uCore: { value: 0 },
          uSunHdr: { value: 1 },
          uCloudA: { value: new THREE.Vector4() },
          uCloudB: { value: new THREE.Vector4() },
          uCloudOpacity: { value: new THREE.Vector2() },
          uCloudBand: { value: new THREE.Vector2() },
        },
      }),
    [],
  )

  // config → uniforms every frame (cheap; keeps the debug GUI live)
  useFrame(() => {
    const c = heroConfig.sky
    const u = material.uniforms
    u.uHorizon.value.set(c.horizon)
    u.uMid.value.set(c.mid)
    u.uZenith.value.set(c.zenith)
    u.uSunColor.value.set(c.sunColor)
    u.uCloud.value.set(c.cloudColor)
    u.uCloudShade.value.set(c.cloudShade)
    u.uSunDir.value.set(...c.sunDir).normalize()
    u.uExposure.value = heroConfig.renderer.exposure
    u.uMidHeight.value = c.midHeight
    u.uZenithHeight.value = c.zenithHeight
    u.uZenithPower.value = c.zenithPower
    u.uHaloPow.value = c.sunHaloPower
    u.uHalo.value = c.sunHalo
    u.uCorePow.value = c.sunCorePower
    u.uCore.value = c.sunCore
    u.uSunHdr.value = c.sunHdr
    cloudVec(c.clouds[0], u.uCloudA.value)
    cloudVec(c.clouds[1], u.uCloudB.value)
    u.uCloudOpacity.value.set(c.clouds[0].opacity, c.clouds[1].opacity)
    u.uCloudBand.value.set(c.cloudLow, c.cloudHigh)
  })

  return (
    <mesh ref={ref} material={material} renderOrder={-1} frustumCulled={false} scale={heroConfig.sky.radius}>
      <sphereGeometry args={[1, 48, 24]} />
    </mesh>
  )
})

