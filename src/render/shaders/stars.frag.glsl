varying vec3 vColor;
varying float vAlpha;
varying float vSize; // device px

void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;

  // Small points read best as soft discs; large ones as a hot core inside a wide glow.
  float disc = 1.0 - smoothstep(0.35, 1.0, sqrt(r2));
  float glow = exp(-r2 * 14.0) + 0.35 * exp(-r2 * 4.0);
  float shape = mix(disc, glow, smoothstep(4.0, 14.0, vSize)) * (1.0 - r2);

  float core = exp(-r2 * 40.0) * smoothstep(6.0, 20.0, vSize);
  vec3 color = mix(vColor, vec3(1.0), clamp(core * 0.8, 0.0, 1.0));

  gl_FragColor = vec4(color, shape * vAlpha);
}
