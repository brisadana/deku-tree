import * as THREE from 'three'
import { treeDeformGLSL } from './treeDeform'
import { U } from '../scene/uniforms'

/**
 * Inverted-hull outline. Extrudes back faces along the view-space normal,
 * scaled by depth so the line keeps a roughly constant on-screen width.
 */
export function makeOutline({ color = '#1B2E26', width = 0.0035, deform = true } = {}) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    fog: true,
    uniforms: {
      ...THREE.UniformsLib.fog,
      uTime: U.uTime,
      uBreath: U.uBreath,
      uWind: U.uWind,
      uColor: { value: new THREE.Color(color) },
      uWidth: { value: width },
    },
    defines: deform ? { DEFORM: 1 } : {},
    vertexShader: /* glsl */ `
      ${treeDeformGLSL}
      uniform float uWidth;
      #include <fog_pars_vertex>
      void main() {
        vec3 p = position;
        #ifdef DEFORM
        p = treeDeform(p);
        #endif
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        mvPosition.xyz += n * uWidth * -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      #include <fog_pars_fragment>
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  })
}
