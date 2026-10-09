#!/usr/bin/env node
/**
 * Downloads the raw source catalogues into data/raw/ (not committed).
 *
 *   HYG star database v4.x (CC BY-SA 4.0) — https://codeberg.org/astronexus/hyg
 *   NASA Exoplanet Archive, Planetary Systems Composite Parameters (pscomppars), via TAP
 *     — https://exoplanetarchive.ipac.caltech.edu
 *
 * Usage: node scripts/fetch-data.js
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { PATHS, MAX_DIST_PC } from './lib/config.js';

const HYG_LISTING = 'https://codeberg.org/api/v1/repos/astronexus/hyg/contents/data/hyg/CURRENT';
// The repository stores the CSV in Git LFS; /media/ serves the real file, /raw/ only the pointer.
const hygMediaUrl = (name) =>
  `https://codeberg.org/astronexus/hyg/media/branch/main/data/hyg/CURRENT/${name}`;

const TAP_URL = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';
// A little beyond 50 ly so hosts on the boundary can still be cross-matched against HYG distances.
// Filter on parallax too: sy_dist is occasionally wrong (GJ 411 is listed at 5.7 pc, but its
// parallax of 392 mas puts it at 2.55 pc), so a bad sy_dist must not drop a nearby host.
const QUERY_DIST_PC = (MAX_DIST_PC + 0.7).toFixed(2);
const QUERY_PLX_MAS = (1000 / (MAX_DIST_PC + 0.7)).toFixed(1);
const PLANET_COLUMNS = [
  'pl_name', 'hostname', 'pl_letter', 'hd_name', 'hip_name', 'gaia_dr3_id', 'sy_snum', 'sy_pnum',
  'discoverymethod', 'disc_year', 'disc_facility', 'pl_controv_flag',
  'pl_orbper', 'pl_orbsmax', 'pl_orbeccen', 'pl_orbincl', 'pl_rade', 'pl_bmasse', 'pl_bmassprov',
  'pl_dens', 'pl_insol', 'pl_eqt',
  'st_spectype', 'st_teff', 'st_rad', 'st_mass', 'st_lum', 'st_age',
  'ra', 'dec', 'sy_dist', 'sy_plx', 'sy_vmag',
];
const PLANET_QUERY = `select ${PLANET_COLUMNS.join(',')} from pscomppars where sy_dist < ${QUERY_DIST_PC} or sy_plx > ${QUERY_PLX_MAS} order by sy_dist, pl_name`;

async function get(url, as = 'text') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  return as === 'buffer' ? Buffer.from(await res.arrayBuffer()) : res.text();
}

async function fetchHyg() {
  const listing = JSON.parse(await get(HYG_LISTING));
  const file = listing.map((f) => f.name).find((n) => /^hyg_v\d+\.csv\.gz$/.test(n));
  if (!file) throw new Error(`No hyg_v*.csv.gz found in ${HYG_LISTING}`);
  const url = hygMediaUrl(file);
  console.log(`HYG: downloading ${file} …`);
  const buf = await get(url, 'buffer');
  if (buf[0] !== 0x1f || buf[1] !== 0x8b) throw new Error(`HYG download is not gzip (got an LFS pointer?)`);
  await writeFile(PATHS.rawHyg, buf);
  console.log(`HYG: ${(buf.length / 1e6).toFixed(1)} MB → ${PATHS.rawHyg}`);
  return { file, url, bytes: buf.length };
}

async function fetchPlanets() {
  const url = `${TAP_URL}?${new URLSearchParams({ query: PLANET_QUERY, format: 'csv' })}`;
  console.log('Exoplanet Archive: querying pscomppars …');
  const csv = await get(url);
  if (!csv.startsWith('pl_name,')) throw new Error(`Unexpected TAP response:\n${csv.slice(0, 500)}`);
  await writeFile(PATHS.rawPlanets, csv);
  const rows = csv.trim().split('\n').length - 1;
  console.log(`Exoplanet Archive: ${rows} planets → ${PATHS.rawPlanets}`);
  return { url: TAP_URL, query: PLANET_QUERY, rows };
}

await mkdir(PATHS.raw, { recursive: true });
const [hyg, planets] = await Promise.all([fetchHyg(), fetchPlanets()]);
await writeFile(
  PATHS.rawSources,
  JSON.stringify({ fetched: new Date().toISOString(), hyg, planets }, null, 2) + '\n',
);
console.log('Done.');
