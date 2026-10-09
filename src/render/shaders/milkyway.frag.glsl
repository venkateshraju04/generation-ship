// A faint procedural Milky Way. The scene is in galactic coordinates, so the band lies along
// the horizontal plane and its bright bulge sits toward +x (galactic longitude 0°).

varying vec3 vDir;
uniform float uIntensity;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * noise(p);
    p *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

void main() {
  vec3 d = normalize(vDir);
  // Scene axes: x → galactic centre, y → north galactic pole, z → longitude 270°.
  float b = asin(clamp(d.y, -1.0, 1.0));
  float l = atan(-d.z, d.x);

  float centre = exp(-l * l / 1.6);
  float width = mix(0.09, 0.2, centre);
  float band = exp(-b * b / (width * width));
  float bulge = exp(-(l * l + 4.0 * b * b) / 0.06);

  float clouds = fbm(d * 7.0);
  float dust = smoothstep(0.45, 0.8, fbm(d * 11.0 + 7.0)) * exp(-b * b / 0.0036) * (0.4 + 0.6 * centre);
  float light = (band * (0.35 + 0.65 * centre) * (0.45 + 0.9 * clouds) + bulge * 0.8) * (1.0 - 0.75 * dust);

  vec3 cool = vec3(0.62, 0.7, 0.95);
  vec3 warm = vec3(1.0, 0.86, 0.68);
  vec3 color = mix(cool, warm, clamp(centre * 0.8 + bulge * 0.2, 0.0, 1.0)) * light * uIntensity;

  // A whisper of noise breaks up 8-bit banding in the gradient.
  color += (hash(d * 1000.0) - 0.5) / 255.0;
  gl_FragColor = vec4(max(color, 0.0), 1.0);
}
