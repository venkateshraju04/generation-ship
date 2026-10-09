// Stars as points whose size and opacity follow their apparent magnitude from the camera,
// so brightness stays physically consistent wherever the camera is.

attribute vec3 starColor;
attribute float absMag;

uniform float uPixelRatio;
uniform float uSizeScale; // CSS px at the reference magnitude
uniform float uMinSize;   // CSS px floor
uniform float uMaxSize;   // CSS px ceiling
uniform float uMinAlpha;  // opacity floor, so map stars stay findable
uniform float uMagRef;    // magnitude with relative flux 1 (the naked-eye limit)

varying vec3 vColor;
varying float vAlpha;
varying float vSize;

const float LY_PER_PC = 3.261563777;
const float LN10 = 2.302585093;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float distPc = max(length(mvPosition.xyz) / LY_PER_PC, 1e-7);
  float appMag = absMag + 5.0 * log(distPc) / LN10 - 5.0;
  float flux = exp(-0.4 * LN10 * (appMag - uMagRef));

  vAlpha = clamp(0.35 * sqrt(flux), uMinAlpha, 1.0);
  vSize = clamp(uSizeScale * pow(flux, 0.3), uMinSize, uMaxSize) * uPixelRatio;
  vColor = starColor;
  gl_PointSize = vSize;
}
