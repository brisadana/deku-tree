import { useFrame } from '@react-three/fiber'
import { DepthOfField, EffectComposer, SMAA, SelectiveBloom, ToneMapping, Vignette } from '@react-three/postprocessing'
import { SMAAPreset, ToneMappingMode, type DepthOfFieldEffect, type SelectiveBloomEffect, type VignetteEffect } from 'postprocessing'
import { useEffect, useRef } from 'react'
import type * as THREE from 'three'
import { heroConfig } from './hero.config'

/*
 * Only registered objects bloom (the eyes). A plain luminance threshold can't do it here:
 * the pastel sky is as bright as the eyes in scene terms. SelectiveBloom masks by depth,
 * so registered objects must write depth, and the sky (far plane) is ignored as background.
 * Objects can register before or after the composer exists.
 */
const bloom = { effect: null as SelectiveBloomEffect | null, pending: new Set<THREE.Object3D>() }

/** Adds an object to the bloom selection; returns the cleanup. */
export function registerBloom(obj: THREE.Object3D | null) {
  if (!obj) return
  if (bloom.effect) bloom.effect.selection.add(obj)
  else bloom.pending.add(obj)
  return () => {
    bloom.pending.delete(obj)
    bloom.effect?.selection.delete(obj)
  }
}

const SMAA_PRESET = { low: SMAAPreset.LOW, medium: SMAAPreset.MEDIUM, high: SMAAPreset.HIGH, ultra: SMAAPreset.ULTRA }

/** Post stack: light DOF on the far forest → selective bloom → ACES → soft vignette → SMAA. */
export function Post() {
  const bloomRef = useRef<SelectiveBloomEffect>(null)
  const dofRef = useRef<DepthOfFieldEffect>(null)
  const vignetteRef = useRef<VignetteEffect>(null)
  const p = heroConfig.post

  // DOF only on the far forest: replace the symmetric circle of confusion with a one-sided
  // ramp, sharp from the lens out to dofFocus, softening over dofRange metres beyond it
  useEffect(() => {
    const coc = dofRef.current?.cocMaterial
    if (!coc) return
    const from = 'float magnitude=smoothstep(0.0,focusRange,abs(signedDistance));gl_FragColor.rg=magnitude*vec2(step(signedDistance,0.0),step(0.0,signedDistance));'
    if (!coc.fragmentShader.includes(from)) return console.warn('[hero] DOF patch: CoC shader changed, using default')
    coc.fragmentShader = coc.fragmentShader.replace(from, 'float magnitude=smoothstep(0.0,focusRange,signedDistance);gl_FragColor.rg=vec2(0.0,magnitude);')
    coc.needsUpdate = true
  }, [])

  useEffect(() => {
    const e = bloomRef.current
    if (!e) return
    bloom.effect = e
    for (const o of bloom.pending) e.selection.add(o)
    bloom.pending.clear()
    return () => {
      bloom.effect = null
    }
  }, [])

  // live-tunable values (GUI)
  useFrame(() => {
    const c = heroConfig.post
    const b = bloomRef.current
    if (b) {
      b.intensity = c.bloomIntensity
      b.luminanceMaterial.threshold = c.bloomThreshold
      b.luminanceMaterial.smoothing = c.bloomSmoothing
      const mip = (b as unknown as { mipmapBlurPass?: { radius: number } }).mipmapBlurPass
      if (mip) mip.radius = c.bloomRadius
    }
    const d = dofRef.current
    if (d) {
      const coc = d.cocMaterial as unknown as { worldFocusDistance: number; worldFocusRange: number }
      coc.worldFocusDistance = c.dofFocus
      coc.worldFocusRange = c.dofRange
      d.bokehScale = c.dofBokeh
    }
    const v = vignetteRef.current
    if (v) {
      v.offset = c.vignetteOffset
      v.darkness = c.vignetteDarkness
    }
  })

  return (
    <EffectComposer multisampling={heroConfig.renderer.multisampling} enableNormalPass={false}>
      <DepthOfField ref={dofRef} worldFocusDistance={p.dofFocus} worldFocusRange={p.dofRange} bokehScale={p.dofBokeh} />
      <SelectiveBloom
        ref={bloomRef}
        lights={[]}
        ignoreBackground
        mipmapBlur
        luminanceThreshold={p.bloomThreshold}
        luminanceSmoothing={p.bloomSmoothing}
        intensity={p.bloomIntensity}
        radius={p.bloomRadius}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette ref={vignetteRef} offset={p.vignetteOffset} darkness={p.vignetteDarkness} />
      <SMAA preset={SMAA_PRESET[p.smaa]} />
    </EffectComposer>
  )
}
