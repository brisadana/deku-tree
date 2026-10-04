import { EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { heroConfig } from './hero.config'

/** Post stack. Tone mapping lives here (the composer turns off the renderer's own). */
export function Post() {
  return (
    <EffectComposer multisampling={heroConfig.renderer.multisampling || 4}>
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
