/**
 * Star colours from effective temperature: integrate Planck's law against the CIE 1931
 * colour-matching functions, convert XYZ → sRGB (D65), and normalise the brightest channel to 1.
 * The Sun comes out a faintly warm white, M dwarfs orange, A stars blue-white.
 */

// Multi-lobe Gaussian fit to the CIE 1931 2° observer (Wyman, Sloan & Shirley 2013).
const lobe = (x, mu, s1, s2) => {
  const t = (x - mu) / (x < mu ? s1 : s2);
  return Math.exp(-0.5 * t * t);
};
const xBar = (l) => 1.056 * lobe(l, 599.8, 37.9, 31.0) + 0.362 * lobe(l, 442.0, 16.0, 26.7) - 0.065 * lobe(l, 501.1, 20.4, 26.2);
const yBar = (l) => 0.821 * lobe(l, 568.8, 46.9, 40.5) + 0.286 * lobe(l, 530.9, 16.3, 31.1);
const zBar = (l) => 1.217 * lobe(l, 437.0, 11.8, 36.0) + 0.681 * lobe(l, 459.0, 26.0, 13.8);

/** Spectral radiance up to a constant factor (which cancels when normalising). */
function planck(nm, T) {
  const m = nm * 1e-9;
  return 1 / (m ** 5 * (Math.exp(1.438776877e-2 / (m * T)) - 1));
}

const encode = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

const cache = new Map();

/** Display (gamma-encoded) sRGB triple in 0–1 for a blackbody at T kelvin. */
export function blackbodyRGB(T) {
  const key = Math.round(T / 10);
  if (cache.has(key)) return cache.get(key);
  const t = Math.max(T, 300);
  let X = 0;
  let Y = 0;
  let Z = 0;
  for (let l = 380; l <= 780; l += 5) {
    const p = planck(l, t);
    X += p * xBar(l);
    Y += p * yBar(l);
    Z += p * zBar(l);
  }
  const linear = [
    3.2406 * X - 1.5372 * Y - 0.4986 * Z,
    -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
    0.0557 * X - 0.204 * Y + 1.057 * Z,
  ].map((c) => Math.max(c, 0));
  const max = Math.max(...linear);
  const rgb = linear.map((c) => encode(c / max));
  cache.set(key, rgb);
  return rgb;
}

/** CSS colour for a temperature, for UI swatches. */
export function temperatureCss(T) {
  const [r, g, b] = blackbodyRGB(T);
  return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
}
