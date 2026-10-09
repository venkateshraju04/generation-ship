#!/usr/bin/env node
/**
 * Builds public/data/planets.json: confirmed planets from the NASA Exoplanet Archive
 * (Planetary Systems Composite Parameters) for every host in stars.json, keyed by star id.
 *
 * Only measured values are stored; missing values stay null; the game estimates them at
 * runtime and labels them as estimates. Run build-stars.js first.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { parseCSVObjects } from './lib/csv.js';
import { PATHS } from './lib/config.js';

const num = (s) => (s == null || s.trim() === '' ? null : Number(s));
const sig = (v, n) => (v == null ? null : Number(v.toPrecision(n)));

const { stars, meta } = JSON.parse(await readFile(PATHS.stars, 'utf8'));
const idByHost = new Map(stars.filter((s) => s.host).map((s) => [s.host, s.id]));

const rows = parseCSVObjects(await readFile(PATHS.rawPlanets, 'utf8'));
const byStar = {};
const skipped = new Set();

for (const p of rows) {
  const id = idByHost.get(p.hostname);
  if (id == null) {
    skipped.add(p.hostname);
    continue;
  }
  (byStar[id] ??= []).push({
    name: p.pl_name,
    letter: p.pl_letter || p.pl_name.split(' ').pop(),
    period: sig(num(p.pl_orbper), 6), // days
    a: sig(num(p.pl_orbsmax), 5), // AU
    e: sig(num(p.pl_orbeccen), 3),
    inc: sig(num(p.pl_orbincl), 4), // degrees
    radius: sig(num(p.pl_rade), 4), // Earth radii
    mass: sig(num(p.pl_bmasse), 4), // Earth masses
    massKind: p.pl_bmassprov || null, // "Mass", "Msini", "M-R relationship", …
    density: sig(num(p.pl_dens), 4), // g/cm³
    insolation: sig(num(p.pl_insol), 4), // Earth flux
    teq: sig(num(p.pl_eqt), 4), // K
    method: p.discoverymethod || null,
    year: num(p.disc_year),
    facility: p.disc_facility || null,
    controversial: p.pl_controv_flag === '1',
  });
}

const orbitKey = (p) => p.a ?? (p.period != null ? (p.period / 365.25) ** (2 / 3) : Infinity);
for (const list of Object.values(byStar)) list.sort((a, b) => orbitKey(a) - orbitKey(b));

const count = Object.values(byStar).reduce((n, l) => n + l.length, 0);
const out = {
  meta: {
    generated: meta.generated,
    source: { ...meta.sources.exoplanetArchive, note: 'Confirmed planets only. Null = not measured.' },
    units: { period: 'days', a: 'AU', inc: 'deg', radius: 'R⊕', mass: 'M⊕', density: 'g/cm³', insolation: 'S⊕', teq: 'K' },
    count,
    hosts: Object.keys(byStar).length,
  },
  byStar,
};

const lines = Object.entries(byStar)
  .map(([id, list]) => `${JSON.stringify(id)}:${JSON.stringify(list)}`)
  .join(',\n');
await writeFile(PATHS.planets, `{"meta":${JSON.stringify(out.meta)},\n"byStar":{\n${lines}\n}}\n`);

console.log(`Planets: ${count} around ${out.meta.hosts} stars → ${PATHS.planets}`);
if (skipped.size) console.log(`  Hosts beyond 50 ly skipped: ${[...skipped].join(', ')}`);
