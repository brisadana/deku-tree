/**
 * Shared vertex deformation for everything that belongs to the tree.
 * Works in tree space: y = 0 at the ground, TREE_HEIGHT (17) at the canopy top.
 */
export const treeDeformGLSL = /* glsl */ `
uniform float uTime;
uniform float uBreath;
uniform float uWind;

float breathCurve(float t) {
  // gentle custom ease: long soft inhale, softer exhale
  float s = 0.5 - 0.5 * cos(t);
  return s * s * (3.0 - 2.0 * s);
}

vec3 treeDeform(vec3 p) {
  float h = p.y;
  float trunk = smoothstep(0.3, 3.5, h) * (1.0 - smoothstep(7.5, 10.5, h));
  float b = breathCurve(uTime * 0.55) * uBreath;
  p.xz *= 1.0 + b * 0.022 * trunk;
  p.y += b * 0.06 * smoothstep(0.0, 8.0, h);

  float canopy = smoothstep(8.5, 13.0, h);
  float w = uWind * canopy;
  p.x += (sin(uTime * 0.7 + h * 0.35 + p.z * 0.2) * 0.16 + sin(uTime * 1.9 + p.x) * 0.03) * w;
  p.z += cos(uTime * 0.6 + p.x * 0.3) * 0.11 * w;
  return p;
}
`
