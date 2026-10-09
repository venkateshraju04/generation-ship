#!/usr/bin/env node
/**
 * Checks the generated catalogue against independently known positions.
 *
 * Reference values: J2000 RA/Dec and distances as listed by SIMBAD / Wikipedia (Gaia DR3 or
 * Hipparcos parallaxes), galactic l/b from SIMBAD. Stored game positions are converted back
 * to RA/Dec and l/b, so this also exercises the equatorial → galactic transform.
 * Exits non-zero on any failure.
 */
import { readFile } from 'node:fs/promises';
import { PATHS } from './lib/config.js';
import { galToEq, unitToRaDec, galToLB, raDecToUnit, eqToGal, angularSeparation } from './lib/coords.js';

const hms = (h, m, s) => (h + m / 60 + s / 3600) * 15;
const dms = (sign, d, m, s) => sign * (d + m / 60 + s / 3600);

// name: [RA°, Dec°, distance ly, galactic l°, galactic b°] (l/b null where not checked)
const REFERENCE = {
  'Proxima Centauri': [hms(14, 29, 42.95), dms(-1, 62, 40, 46.2), 4.2465, 313.94, -1.93],
  'Alpha Centauri A': [hms(14, 39, 36.49), dms(-1, 60, 50, 2.3), 4.37, 315.73, -0.68],
  "Barnard's Star": [hms(17, 57, 48.50), dms(1, 4, 41, 36.2), 5.96, 31.01, 14.06],
  'Sirius A': [hms(6, 45, 8.92), dms(-1, 16, 42, 58.0), 8.60, 227.23, -8.89],
  'Procyon A': [hms(7, 39, 18.12), dms(1, 5, 13, 30.0), 11.46, null, null],
  'Tau Ceti': [hms(1, 44, 4.08), dms(-1, 15, 56, 14.9), 11.91, null, null],
  'Epsilon Eridani': [hms(3, 32, 55.84), dms(-1, 9, 27, 29.7), 10.47, null, null],
  '61 Cygni A': [hms(21, 6, 53.94), dms(1, 38, 44, 57.9), 11.40, null, null],
  Vega: [hms(18, 36, 56.34), dms(1, 38, 47, 1.3), 25.04, null, null],
  'TRAPPIST-1': [hms(23, 6, 29.28), dms(-1, 5, 2, 28.6), 40.66, null, null],
};

// Separations between pairs of stars, in light-years.
const PAIRS = [
  ['Sirius A', 'Procyon A', 5.24, 0.15],
  ['Alpha Centauri A', 'Proxima Centauri', 0.21, 0.06],
];

const POS_TOL_DEG = 0.05; // allows for proper motion between catalogue epochs
const DIST_TOL = 0.03; // 3%
const LB_TOL_DEG = 0.05;

const { stars } = JSON.parse(await readFile(PATHS.stars, 'utf8'));
const { byStar } = JSON.parse(await readFile(PATHS.planets, 'utf8'));
const byName = new Map(stars.map((s) => [s.name, s]));

let failures = 0;
const check = (ok, label, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? '  ✓' : '  ✗'} ${label.padEnd(44)} ${detail}`);
};

console.log('Frame transform');
{
  const ngp = galToLB(eqToGal(raDecToUnit(192.85948, 27.12825)));
  check(ngp.b > 89.999, 'North galactic pole → b = +90°', `b = ${ngp.b.toFixed(4)}°`);
  const gc = galToLB(eqToGal(raDecToUnit(266.405, -28.93617)));
  const l = gc.l > 180 ? gc.l - 360 : gc.l;
  check(Math.abs(l) < 0.01 && Math.abs(gc.b) < 0.01, 'Galactic centre → l = 0°, b = 0°', `l = ${l.toFixed(4)}°, b = ${gc.b.toFixed(4)}°`);
}

console.log('\nStar positions (game data → RA/Dec, distance, galactic l/b)');
for (const [name, [ra, dec, dist, l, b]] of Object.entries(REFERENCE)) {
  const s = byName.get(name);
  if (!s) {
    check(false, name, 'not found in stars.json');
    continue;
  }
  const v = [s.x, s.y, s.z];
  const d = Math.hypot(...v);
  const eq = unitToRaDec(galToEq(v));
  const sep = angularSeparation(ra, dec, eq.ra, eq.dec);
  check(sep < POS_TOL_DEG, `${name}: sky position`, `RA ${eq.ra.toFixed(3)}° Dec ${eq.dec.toFixed(3)}° (off by ${(sep * 3600).toFixed(0)}″)`);
  const err = Math.abs(d - dist) / dist;
  check(err < DIST_TOL, `${name}: distance`, `${d.toFixed(3)} ly vs ${dist} ly (${(err * 100).toFixed(1)}%)`);
  if (l != null) {
    const g = galToLB(v);
    const dl = Math.abs(((g.l - l + 540) % 360) - 180);
    check(dl < LB_TOL_DEG && Math.abs(g.b - b) < LB_TOL_DEG, `${name}: galactic l/b`, `l ${g.l.toFixed(2)}° b ${g.b.toFixed(2)}° vs ${l}°, ${b}°`);
  }
}

console.log('\nSeparations');
for (const [a, b, expected, tol] of PAIRS) {
  const sa = byName.get(a);
  const sb = byName.get(b);
  const d = Math.hypot(sa.x - sb.x, sa.y - sb.y, sa.z - sb.z);
  check(Math.abs(d - expected) <= tol, `${a} ↔ ${b}`, `${d.toFixed(3)} ly vs ${expected} ± ${tol}`);
}

console.log('\nCatalogue');
const planetsOf = (name) => byStar[byName.get(name)?.id] ?? [];
check(stars.length > 900, 'Stars within 50 ly', `${stars.length}`);
check(stars[0].name === 'Sol' && stars[0].d === 0, 'Sol is at the origin', `${stars[0].name} @ ${stars[0].d} ly`);
check(planetsOf('TRAPPIST-1').length === 7, 'TRAPPIST-1 has 7 planets', `${planetsOf('TRAPPIST-1').map((p) => p.letter).join(' ')}`);
check(planetsOf('Proxima Centauri').some((p) => p.letter === 'b'), 'Proxima Centauri b exists', `${planetsOf('Proxima Centauri').map((p) => p.letter).join(' ')}`);
check(planetsOf("Teegarden's Star").length >= 2, "Teegarden's Star has planets", `${planetsOf("Teegarden's Star").map((p) => p.letter).join(' ')}`);
const sirB = byName.get('Sirius B');
check(sirB?.cls === 'D' && sirB.sys === byName.get('Sirius A')?.sys, 'Sirius B is a white dwarf in the Sirius system', `${sirB?.spect}, ${sirB?.teff} K`);
const ids = new Set(stars.map((s) => s.id));
check(ids.size === stars.length, 'Star ids are unique', `${ids.size}`);
const orphans = Object.keys(byStar).filter((id) => !ids.has(Number(id)));
check(orphans.length === 0, 'Every planet host is in stars.json', orphans.length ? orphans.join(', ') : 'yes');

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
