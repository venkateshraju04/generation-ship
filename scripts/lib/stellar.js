/**
 * Stellar parameters derived from catalogue data (spectral type, B–V colour, absolute V magnitude).
 *
 * The tables are approximate main-sequence calibrations after Pecaut & Mamajek (2013,
 * "A Modern Mean Dwarf Stellar Color and Effective Temperature Sequence"). They are good to
 * a few percent in temperature and ~30% in luminosity — fine for a game, and every derived
 * value is flagged so the UI can mark it as an estimate. Measured values from the NASA
 * Exoplanet Archive override these for planet hosts.
 */

const CLASS_INDEX = { O: 0, B: 1, A: 2, F: 3, G: 4, K: 5, M: 6, L: 7, T: 8, Y: 9 };
const SUN_TEFF = 5772;
const SUN_MBOL = 4.74;

// [spectral code (class index × 10 + subtype), Teff K]
const DWARF_TEFF = [
  [5, 41400], [9, 31900], [10, 31400], [12, 20600], [15, 15700], [18, 12500],
  [20, 9700], [25, 8100], [30, 7220], [35, 6510], [40, 5920], [42, 5770], [45, 5660],
  [48, 5490], [50, 5270], [52, 5040], [55, 4440], [57, 4050], [60, 3850], [61, 3680],
  [62, 3560], [63, 3430], [64, 3210], [65, 3060], [66, 2810], [67, 2680], [68, 2570],
  [69, 2380], [70, 2250], [75, 1600], [80, 1300], [85, 1100], [88, 750], [89, 600],
  [90, 450], [92, 350],
];

// Giants are cooler than dwarfs of the same type (G–M only).
const GIANT_TEFF = [
  [40, 5500], [45, 5050], [48, 4900], [50, 4750], [52, 4450], [55, 3950], [60, 3850],
  [62, 3700], [65, 3400],
];

// [absolute V magnitude, Teff K] along the main sequence — used when only a class letter is known.
const MV_TEFF = [
  [-1.1, 15700], [1.1, 9700], [1.9, 8100], [2.5, 7220], [3.4, 6510], [4.4, 5920], [4.8, 5770],
  [5.1, 5660], [5.8, 5270], [7.3, 4440], [8.9, 3850], [10.0, 3560], [11.0, 3430], [12.3, 3210],
  [13.8, 3060], [16.4, 2810], [17.5, 2680], [18.6, 2570], [19.4, 2380],
];

// [Teff K, bolometric correction BC_V]
const TEFF_BC = [
  [500, -12], [1000, -9], [1500, -7.5], [2000, -6.0], [2380, -5.2], [2570, -4.8], [2680, -4.4],
  [2810, -4.0], [3060, -3.0], [3210, -2.5], [3430, -1.9], [3560, -1.6], [3850, -1.15],
  [4000, -0.9], [4440, -0.55], [4800, -0.35], [5300, -0.17], [5770, -0.07], [5900, -0.05],
  [6500, -0.01], [7200, 0.0], [8100, -0.05], [9700, -0.25], [10000, -0.35], [12000, -0.8],
  [15700, -1.4], [20000, -2.0], [26000, -2.6], [31000, -3.0], [40000, -3.9],
];

/** Linear interpolation in a table sorted by its first column; clamps at the ends. */
function interp(table, x) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    if (x <= x1) {
      const [x0, y0] = table[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

/**
 * Parses spectral strings as they appear in HYG and the Exoplanet Archive, including the
 * old Gliese-catalogue forms: "dM4.5e", "sdM4", "k-m", bare "m", and white dwarfs ("DA2", "DQP8").
 * Returns { cls, sub, lc } or null. lc is a luminosity class: V, IV, III, II, I, VI (subdwarf), WD.
 */
export function parseSpectral(raw) {
  const s = (raw ?? '').trim();
  if (!s) return null;

  const wd = s.match(/^D[ABOQZCXP]*\s*(\d+(?:\.\d+)?)?/);
  if (wd) return { cls: 'D', sub: wd[1] != null ? Number(wd[1]) : null, lc: 'WD' };

  let body = s;
  let lc = null;
  if (body.startsWith('sd')) {
    lc = 'VI';
    body = body.slice(2);
  } else if (/^d[A-Z]/.test(body)) {
    lc = 'V';
    body = body.slice(1);
  } else if (/^g[A-Z]/.test(body)) {
    lc = 'III';
    body = body.slice(1);
  }
  if (/^k-m/i.test(body)) return { cls: 'K', sub: 7, lc: lc ?? 'V' };

  const m = body.match(/^([OBAFGKMLTY])\s*(\d+(?:\.\d+)?)?/i);
  if (!m) return null;
  const cls = m[1].toUpperCase();
  const sub = m[2] != null ? Number(m[2]) : null;
  if (['L', 'T', 'Y'].includes(cls)) return { cls, sub, lc: 'BD' };
  if (!lc) {
    // Order matters: longest numerals first so "III" is not read as "I".
    const rest = body.slice(m[0].length).match(/^\s*(Iab|Ia|Ib|III|II|IV|VI|V|I)/);
    lc = rest ? rest[1].replace(/^I[ab]+$/, 'I') : 'V';
  }
  return { cls, sub, lc };
}

const isGiant = (lc) => lc === 'III' || lc === 'II' || lc === 'I';

/** Ballesteros (2012) blackbody fit: B–V colour index → effective temperature. */
export function teffFromBV(bv) {
  const c = Math.max(-0.4, Math.min(2.0, bv));
  return 4600 * (1 / (0.92 * c + 1.7) + 1 / (0.92 * c + 0.62));
}

function classTeffRange(cls) {
  const i = CLASS_INDEX[cls];
  return [interp(DWARF_TEFF, i * 10 + 9.9), interp(DWARF_TEFF, i * 10)];
}

/** Best-available effective temperature. Returns { teff, from }. */
export function deriveTeff(sp, ci, absmag) {
  if (sp?.cls === 'D') {
    if (sp.sub) return { teff: 50400 / Math.max(sp.sub, 1), from: 'spectral' };
    return { teff: ci != null ? teffFromBV(ci) : 10000, from: ci != null ? 'colour' : 'default' };
  }
  if (sp && sp.sub != null) {
    const code = CLASS_INDEX[sp.cls] * 10 + sp.sub;
    const table = isGiant(sp.lc) && code >= 40 && code < 70 ? GIANT_TEFF : DWARF_TEFF;
    return { teff: interp(table, code), from: 'spectral' };
  }
  if (sp) {
    // Class letter only (e.g. Gliese "m"): refine within the class using magnitude or colour.
    const [lo, hi] = classTeffRange(sp.cls);
    const guess = !isGiant(sp.lc) && absmag != null ? interp(MV_TEFF, absmag) : ci != null ? teffFromBV(ci) : (lo + hi) / 2;
    return { teff: Math.min(hi, Math.max(lo, guess)), from: 'spectral' };
  }
  if (ci != null) return { teff: teffFromBV(ci), from: 'colour' };
  if (absmag != null) return { teff: interp(MV_TEFF, absmag), from: 'magnitude' };
  return { teff: 5000, from: 'default' };
}

export const bolometricCorrection = (teff) => interp(TEFF_BC, teff);

/** Bolometric luminosity in solar units from absolute V magnitude. */
export function luminosityFromAbsMag(absmag, teff) {
  return 10 ** (-0.4 * (absmag + bolometricCorrection(teff) - SUN_MBOL));
}

/** Absolute V magnitude from bolometric luminosity (inverse of the above). */
export function absMagFromLuminosity(lum, teff) {
  return SUN_MBOL - 2.5 * Math.log10(lum) - bolometricCorrection(teff);
}

/** Stefan–Boltzmann radius in solar radii. */
export const radiusFrom = (lum, teff) => Math.sqrt(lum) * (SUN_TEFF / teff) ** 2;

/**
 * Mass in solar masses. Main sequence uses an inverted piecewise mass–luminosity relation
 * (L ∝ 0.23 M^2.3 below 0.43 M☉, M^4 to 2 M☉, 1.4 M^3.5 above); other classes use typical values.
 */
export function massFrom(lum, sp) {
  if (sp?.cls === 'D') return 0.6;
  if (sp?.lc === 'BD') return sp.cls === 'L' ? 0.07 : sp.cls === 'T' ? 0.04 : 0.015;
  if (isGiant(sp?.lc)) return 1.5;
  let m = lum ** 0.25;
  if (m < 0.43) m = (lum / 0.23) ** (1 / 2.3);
  else if (m > 2) m = (lum / 1.4) ** (1 / 3.5);
  return m;
}

export const SUN = { teff: SUN_TEFF, lum: 1, mass: 1, radius: 1 };
