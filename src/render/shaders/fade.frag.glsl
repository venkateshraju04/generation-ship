uniform float uOpacity;

varying vec3 vTint;
varying float vFade;

void main() {
  gl_FragColor = vec4(vTint, uOpacity * vFade);
}
