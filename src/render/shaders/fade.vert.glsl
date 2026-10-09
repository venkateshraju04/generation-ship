// Depth lines and their feet on the galactic plane, faded out away from the camera's focus
// so the map stays readable when zoomed in on one region.

attribute vec3 tint;

uniform vec3 uFocus;
uniform float uRadius;
uniform float uPixelRatio;

varying vec3 vTint;
varying float vFade;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vFade = 1.0 - smoothstep(uRadius * 0.45, uRadius, distance(world.xyz, uFocus));
  vTint = tint;
  gl_Position = projectionMatrix * viewMatrix * world;
  gl_PointSize = 2.5 * uPixelRatio;
}
