/**
 * Celestial coordinate helpers.
 *
 * Equatorial (ICRS/J2000) unit vectors: x → RA 0h Dec 0°, z → north celestial pole.
 * Galactic unit vectors: x → galactic centre (l = 0°, b = 0°), y → l = 90°, z → north galactic pole.
 */

const DEG = Math.PI / 180;

/** Equatorial → galactic rotation (Hipparcos catalogue, ESA SP-1200 vol. 1 §1.5.3). */
export const EQ_TO_GAL = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.4448296300, 0.7469822445],
  [-0.8676661490, -0.1980763734, 0.4559837762],
];

export function raDecToUnit(raDeg, decDeg) {
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  const c = Math.cos(dec);
  return [c * Math.cos(ra), c * Math.sin(ra), Math.sin(dec)];
}

export function unitToRaDec([x, y, z]) {
  const r = Math.hypot(x, y, z);
  let ra = Math.atan2(y, x) / DEG;
  if (ra < 0) ra += 360;
  return { ra, dec: Math.asin(z / r) / DEG };
}

const mul = (m, [x, y, z]) => [
  m[0][0] * x + m[0][1] * y + m[0][2] * z,
  m[1][0] * x + m[1][1] * y + m[1][2] * z,
  m[2][0] * x + m[2][1] * y + m[2][2] * z,
];
const transpose = (m) => m[0].map((_, j) => m.map((row) => row[j]));
const GAL_TO_EQ = transpose(EQ_TO_GAL);

export const eqToGal = (v) => mul(EQ_TO_GAL, v);
export const galToEq = (v) => mul(GAL_TO_EQ, v);

/** Galactic longitude/latitude in degrees from a galactic Cartesian vector. */
export function galToLB([x, y, z]) {
  const r = Math.hypot(x, y, z);
  let l = Math.atan2(y, x) / DEG;
  if (l < 0) l += 360;
  return { l, b: Math.asin(z / r) / DEG };
}

/** Great-circle separation in degrees (haversine; stable for tiny angles). */
export function angularSeparation(ra1, dec1, ra2, dec2) {
  const dRa = (ra2 - ra1) * DEG;
  const dDec = (dec2 - dec1) * DEG;
  const a =
    Math.sin(dDec / 2) ** 2 + Math.cos(dec1 * DEG) * Math.cos(dec2 * DEG) * Math.sin(dRa / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(a)))) / DEG;
}
