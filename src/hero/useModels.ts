import { useGLTF } from '@react-three/drei'
import { heroConfig } from './hero.config'

const { forest, tree, dracoPath } = heroConfig.models

// Forest is Draco, the tree is meshopt; both decoders are local (no CDN).
export const useForest = () => useGLTF(forest, dracoPath, true)
export const useTree = () => useGLTF(tree, dracoPath, true)

export function preloadModels() {
  useGLTF.preload(forest, dracoPath, true)
  useGLTF.preload(tree, dracoPath, true)
}
