#!/usr/bin/env node
/**
 * Builds the star catalogues the game loads:
 *
 *   public/data/stars.json — every star within 50 ly (selectable), grouped into systems,
 *                            with names, galactic positions and physical parameters.
 *   public/data/sky.json   — naked-eye stars beyond 50 ly, as a flat array for the backdrop.
 *
 * Sources: data/raw/hyg.csv.gz and data/raw/pscomppars.csv (run fetch-data.js first).
 * Exoplanet hosts are cross-matched to HYG by HIP, HD, Gliese number, then sky position;
 * hosts HYG lacks (TRAPPIST-1, Teegarden's Star, …) are added from the Archive's own data.
 *
 * Positions are galactic Cartesian light-years with the Sun at the origin:
 * +x toward the galactic centre, +y toward l = 90°, +z toward the north galactic pole.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { parseCSVObjects } from './lib/csv.js';
import { PATHS, LY_PER_PC, MAX_DIST_PC, SKY_MAG_LIMIT, UNKNOWN_DIST_PC } from './lib/config.js';
import { raDecToUnit, eqToGal, angularSeparation } from './lib/coords.js';
import {
  parseSpectral, deriveTeff, luminosityFromAbsMag, absMagFromLuminosity, radiusFrom, massFrom, SUN,
} from './lib/stellar.js';
import {
  GENITIVE, bayerNames, flamsteedName, glKey, glComponent, glDisplay, stripComponent, expandDesignation,
} from './lib/names.js';

const num = (s) => (s == null || s.trim() === '' ? null : Number(s));
const round = (v, d) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
const sig = (v, n) => (v == null ? null : Number(v.toPrecision(n)));
const catNumber = (s, prefix) => s?.match(new RegExp(`^${prefix}\\s*(\\d+)`))?.[1] ?? null;

function galacticLy(ra, dec, distPc, digits) {
  const d = distPc * LY_PER_PC;
  return eqToGal(raDecToUnit(ra, dec)).map((v) => round(v * d, digits));
}

/** FNV-1a, for stable ids of stars that only exist in the Exoplanet Archive. */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (const ch of str) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// ---------------------------------------------------------------------------------------------
// Load sources

const sources = JSON.parse(await readFile(PATHS.rawSources, 'utf8'));
const curated = JSON.parse(await readFile(join(PATHS.curated, 'names.json'), 'utf8'));
const corrections = JSON.parse(await readFile(join(PATHS.curated, 'corrections.json'), 'utf8')).stars;

const hyg = parseCSVObjects(gunzipSync(await readFile(PATHS.rawHyg)).toString('utf8')).map((r) => ({
  id: Number(r.id),
  hip: r.hip || null,
  hd: r.hd || null,
  gl: r.gl.trim() || null,
  proper: r.proper.trim() || null,
  bayer: r.bayer || null,
  flam: r.flam || null,
  con: r.con || null,
  ra: Number(r.ra) * 15, // HYG stores right ascension in hours
  dec: Number(r.dec),
  distPc: Number(r.dist), // 100000 = no usable parallax
  mag: num(r.mag),
  absmag: num(r.absmag),
  spect: r.spect.trim() || null,
  ci: num(r.ci),
  comp: Number(r.comp) || 1,
  compPrimary: num(r.comp_primary) ?? Number(r.id),
}));

const planetRows = parseCSVObjects(await readFile(PATHS.rawPlanets, 'utf8'));
const hosts = [];
const seenHost = new Set();
for (const p of planetRows) {
  if (seenHost.has(p.hostname)) continue;
  seenHost.add(p.hostname);
  hosts.push({
    name: p.hostname,
    hip: catNumber(p.hip_name, 'HIP'),
    hd: catNumber(p.hd_name, 'HD'),
    gl: glKey(p.hostname),
    ra: num(p.ra),
    dec: num(p.dec),
    // The parallax is the measurement; sy_dist is derived and occasionally wrong.
    distPc: num(p.sy_plx) > 0 ? 1000 / num(p.sy_plx) : num(p.sy_dist),
    vmag: num(p.sy_vmag),
    spect: p.st_spectype || null,
    teff: num(p.st_teff),
    radius: num(p.st_rad),
    mass: num(p.st_mass),
    logLum: num(p.st_lum),
    snum: num(p.sy_snum) ?? 1,
  });
}

// ---------------------------------------------------------------------------------------------
// Cross-match Exoplanet Archive hosts to HYG

const byHip = new Map();
const byHd = new Map();
const byGl = new Map();
const byGlNumber = new Map();
for (const s of hyg) {
  if (s.hip) byHip.set(s.hip, s);
  if (s.hd) byHd.set(s.hd, s);
  const k = glKey(s.gl);
  if (k) {
    byGl.set(k, s);
    const n = k.replace(/[A-Z]+$/, '');
    if (!byGlNumber.has(n)) byGlNumber.set(n, []);
    byGlNumber.get(n).push(s);
  }
}

const sep = (h, s) => angularSeparation(h.ra, h.dec, s.ra, s.dec);
const distMismatch = (h, s) => Math.abs(s.distPc - h.distPc) / h.distPc;
const archiveDistanceWins = (h, s) => distMismatch(h, s) > 0.1;

const matchOf = new Map(); // host name → { star, method }
const hostOf = new Map(); // HYG id → host
const claim = (h, star, method) => {
  matchOf.set(h.name, { star, method });
  hostOf.set(star.id, h);
};

// Pass 1: catalogue identifiers, sanity-checked against sky position only (not distance: HYG's
// older parallaxes are sometimes far off, e.g. GJ 1132 at 56 ly where Gaia measures 41).
// When the two disagree by more than 10%, the Archive's Gaia-era parallax wins.
const distanceDisagreements = [];
for (const h of hosts) {
  const tries = [];
  if (h.hip && byHip.has(h.hip)) tries.push(['HIP', byHip.get(h.hip)]);
  if (h.hd && byHd.has(h.hd)) tries.push(['HD', byHd.get(h.hd)]);
  if (h.gl) {
    if (byGl.has(h.gl)) tries.push(['Gliese', byGl.get(h.gl)]);
    else if (!/[A-Z]$/.test(h.gl)) for (const s of byGlNumber.get(h.gl) ?? []) tries.push(['Gliese', s]);
  }
  const ok = tries.filter(([, s]) => !hostOf.has(s.id) && sep(h, s) < 0.5);
  if (!ok.length) continue;
  // Several Gliese components can share a number; take the closest on the sky.
  const [method, star] = ok.sort((a, b) => (a[0] === b[0] ? sep(h, a[1]) - sep(h, b[1]) : 0))[0];
  claim(h, star, method);
  if (distMismatch(h, star) > 0.1) {
    distanceDisagreements.push(`${h.name}: HYG ${star.distPc} pc → Archive ${h.distPc.toFixed(4)} pc`);
  }
}

// Pass 2: sky position for the rest. 0.06° allows ~16 years of proper motion between
// HYG's J2000 positions and the Archive's Gaia-epoch positions for all but the fastest stars.
const positional = hyg.filter((s) => s.distPc > 0 && s.distPc < 40);
for (const h of hosts) {
  if (matchOf.has(h.name)) continue;
  let best = null;
  let bestSep = 0.06;
  for (const s of positional) {
    if (hostOf.has(s.id) || distMismatch(h, s) > 0.25) continue;
    const d = sep(h, s);
    if (d < bestSep) [best, bestSep] = [s, d];
  }
  if (best) claim(h, best, 'position');
}

// ---------------------------------------------------------------------------------------------
// Select stars

const selected = new Map(); // HYG id → HYG row
for (const s of hyg) if (s.distPc <= MAX_DIST_PC) selected.set(s.id, s);

// Hosts the Archive puts within 50 ly but HYG puts beyond are kept: either the Archive's distance
// wins (see above), or HYG's is within 10% of the limit.
const addedFromHyg = [];
const archiveOnly = [];
for (const h of hosts) {
  if (h.distPc > MAX_DIST_PC) continue;
  const m = matchOf.get(h.name);
  if (m && !selected.has(m.star.id) && (archiveDistanceWins(h, m.star) || m.star.distPc <= MAX_DIST_PC * 1.1)) {
    selected.set(m.star.id, m.star);
    addedFromHyg.push(`${h.name} (HYG ${(m.star.distPc * LY_PER_PC).toFixed(1)} ly)`);
  } else if (!m) {
    archiveOnly.push(h);
  }
}

// ---------------------------------------------------------------------------------------------
// Names

const GOULD = /^(\d+) G\. ([A-Z][a-z]{2})$/;

/** The star's own best name and whether it is a real name (vs. a bare catalogue number). */
function ownName(s, host) {
  if (s.id === 0) return { name: 'Sol', strong: true };
  const k = glKey(s.gl);
  if (s.proper && curated.byProper[s.proper]) return { name: curated.byProper[s.proper], strong: true };
  if (k && curated.byGliese[k]) return { name: curated.byGliese[k], strong: true };
  if (s.proper) {
    const g = s.proper.match(GOULD);
    return { name: g && GENITIVE[g[2]] ? `${g[1]} G. ${GENITIVE[g[2]]}` : s.proper, strong: true };
  }
  const bayer = bayerNames(s.bayer, s.con);
  if (bayer) return { name: bayer.spelled, strong: true };
  const flam = flamsteedName(s.flam, s.con);
  if (flam) return { name: flam, strong: true };
  if (host && !glKey(host.name)) return { name: expandDesignation(host.name), strong: true };
  if (s.gl) return { name: glDisplay(s.gl), strong: false };
  if (s.hd) return { name: `HD ${s.hd}`, strong: false };
  if (s.hip) return { name: `HIP ${s.hip}`, strong: false };
  return { name: `HYG ${s.id}`, strong: false };
}

function aliasesOf(s, host) {
  const out = s.id === 0 ? ['Sun', 'the Sun'] : [];
  const k = glKey(s.gl);
  if (s.proper) out.push(s.proper);
  const bayer = bayerNames(s.bayer, s.con);
  if (bayer) out.push(bayer.greek, bayer.spelled);
  const flam = flamsteedName(s.flam, s.con);
  if (flam) out.push(flam);
  if (s.gl) {
    out.push(glDisplay(s.gl));
    if (k) out.push(`GJ ${k.replace(/([A-Z]+)$/, ' $1')}`, `Gliese ${k.replace(/([A-Z]+)$/, ' $1')}`);
  }
  if (s.hd) out.push(`HD ${s.hd}`);
  if (s.hip) out.push(`HIP ${s.hip}`);
  if (host) out.push(host.name, expandDesignation(host.name));
  if (k && curated.aliases[k]) out.push(...curated.aliases[k]);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Build star records

const usedIds = new Set(selected.keys());

function physical({ spect, ci, absmag, host, fix, isSun }) {
  if (isSun) return { sp: parseSpectral('G2V'), ...SUN, absmag: 4.83, est: [] };
  let sp = parseSpectral(spect);
  // A giant or supergiant class on a star this faint is a catalogue error; treat it as a dwarf.
  if (sp && ['I', 'II', 'III'].includes(sp.lc) && absmag != null && absmag > 4) sp = { ...sp, lc: 'V' };
  const est = [];
  let { teff, from } = deriveTeff(sp, ci, absmag);
  if (fix?.teff) teff = fix.teff;
  else if (host?.teff) teff = host.teff;
  else if (from !== 'spectral' || sp?.sub == null) est.push('teff');

  let lum = host?.logLum != null ? 10 ** host.logLum : null;
  if (lum == null && host?.radius) lum = host.radius ** 2 * (teff / SUN.teff) ** 4;
  if (lum == null && absmag != null) {
    lum = luminosityFromAbsMag(absmag, teff);
    est.push('lum');
  }
  if (lum == null) {
    // No magnitude and no measured luminosity (e.g. a cold brown dwarf): assume a typical radius.
    lum = (sp?.lc === 'BD' ? 0.1 : 0.2) ** 2 * (teff / SUN.teff) ** 4;
    est.push('lum');
  }
  if (absmag == null) absmag = absMagFromLuminosity(lum, teff);

  const radius = host?.radius ?? radiusFrom(lum, teff);
  if (!host?.radius) est.push('radius');
  const mass = host?.mass ?? massFrom(lum, sp);
  if (!host?.mass) est.push('mass');
  return { sp, teff, lum, radius, mass, absmag, est };
}

const records = [];

for (const s of selected.values()) {
  const host = hostOf.get(s.id) ?? null;
  const fix = corrections[s.id] ?? null;
  const isSun = s.id === 0;
  // Planet hosts get the Archive's modern spectral type; HYG's Gliese-era types are sometimes off.
  const spect = fix?.spect ?? host?.spect ?? s.spect;
  const pos = host && archiveDistanceWins(host, s) ? host : s;
  const absmag = pos === s ? s.absmag : s.mag - 5 * Math.log10(pos.distPc / 10);
  const phys = physical({ spect, ci: s.ci, absmag, host, fix, isSun });
  const [x, y, z] = isSun ? [0, 0, 0] : galacticLy(pos.ra, pos.dec, pos.distPc, 4);
  records.push({
    id: s.id,
    src: 'hyg',
    own: ownName(s, host),
    aliases: aliasesOf(s, host),
    compLetter: glComponent(s.gl),
    compIndex: s.comp,
    primaryId: selected.has(s.compPrimary) ? s.compPrimary : s.id,
    x, y, z,
    distPc: pos.distPc,
    ra: pos.ra,
    dec: pos.dec,
    mag: s.mag,
    spect,
    hip: s.hip,
    hd: s.hd,
    gl: s.gl,
    host: host?.name ?? null,
    ...phys,
  });
}

// Hosts missing from HYG, built from the Archive's own coordinates and stellar parameters.
for (const h of archiveOnly) {
  let id = 1_000_000 + (fnv1a(h.name) % 1_000_000);
  while (usedIds.has(id)) id++;
  usedIds.add(id);
  const absmag = h.vmag != null ? h.vmag - 5 * Math.log10(h.distPc / 10) : null;
  const phys = physical({ spect: h.spect, ci: null, absmag, host: h });
  const [x, y, z] = galacticLy(h.ra, h.dec, h.distPc, 4);
  records.push({
    id,
    src: 'archive',
    own: { name: expandDesignation(h.name), strong: true },
    aliases: [h.name],
    compLetter: h.name.match(/\s([A-C])$/)?.[1] ?? null,
    compIndex: 1,
    primaryId: id,
    x, y, z,
    distPc: h.distPc,
    ra: h.ra,
    dec: h.dec,
    mag: h.vmag,
    spect: h.spect,
    hip: h.hip,
    hd: h.hd,
    gl: null,
    host: h.name,
    snum: h.snum,
    ...phys,
  });
}

// ---------------------------------------------------------------------------------------------
// Systems

const recById = new Map(records.map((r) => [r.id, r]));
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// Archive-only hosts flagged as multiple-star systems join the nearest star within 0.1 ly.
for (const r of records) {
  if (r.src !== 'archive' || (r.snum ?? 1) < 2) continue;
  let best = null;
  for (const o of records) {
    if (o === r || o.src === 'archive') continue;
    const d = dist3(r, o);
    if (d < 0.1 && (!best || d < dist3(r, best))) best = o;
  }
  if (best) r.primaryId = best.primaryId;
}

const members = new Map();
for (const r of records) {
  if (!recById.has(r.primaryId)) r.primaryId = r.id;
  if (!members.has(r.primaryId)) members.set(r.primaryId, []);
  members.get(r.primaryId).push(r);
}

const LETTERS = 'ABCDEFGH';
for (const [primaryId, group] of members) {
  const primary = recById.get(primaryId);
  group.sort((a, b) => (a === primary ? -1 : b === primary ? 1 : a.compIndex - b.compIndex));
  const multiple = group.length > 1;
  group.forEach((r, i) => {
    const letter = r.compLetter ?? (multiple ? LETTERS[Math.min(r.compIndex - 1, 7)] ?? LETTERS[i] : null);
    let name = r.own.name;
    // Companions without a name of their own take the primary's: "Sirius B", "40 Eridani C".
    if (r !== primary && !r.own.strong && letter) name = `${stripComponent(primary.own.name)} ${letter}`;
    else if (multiple && letter && !/\s[A-C]$/.test(name)) name = `${name} ${letter}`;
    r.name = name;
    r.comp = multiple ? letter : null;
  });
  const sysName = stripComponent(primary.own.name);
  for (const r of group) {
    r.sys = primaryId;
    r.sysName = sysName;
    // Catalogues often give companions their own (noisier) parallax, which would put bound
    // companions light-months apart. Keep each one's direction but use the primary's distance.
    if (r !== primary && r.distPc !== primary.distPc) {
      [r.x, r.y, r.z] = galacticLy(r.ra, r.dec, primary.distPc, 4);
      r.distPc = primary.distPc;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Output

const stars = records
  .map((r) => {
    const aliases = [...new Set([...r.aliases, r.own.name, r.sysName])].filter(
      (a) => a && a !== r.name,
    );
    return {
      id: r.id,
      name: r.name,
      sys: r.sys,
      sysName: r.sysName,
      comp: r.comp,
      aliases,
      x: r.x,
      y: r.y,
      z: r.z,
      d: round(Math.hypot(r.x, r.y, r.z), 3),
      ra: round(r.ra, 4),
      dec: round(r.dec, 4),
      mag: round(r.mag, 2),
      absmag: round(r.absmag, 2),
      spect: r.spect,
      cls: r.sp?.cls ?? null,
      sub: r.sp?.sub ?? null,
      lc: r.sp?.lc ?? null,
      teff: Math.round(r.teff),
      lum: sig(r.lum, 4),
      mass: sig(r.mass, 3),
      radius: sig(r.radius, 3),
      est: r.est,
      hip: r.hip ? Number(r.hip) : null,
      hd: r.hd ? Number(r.hd) : null,
      gl: r.gl,
      host: r.host,
      src: r.src,
    };
  })
  .sort((a, b) => a.d - b.d || a.id - b.id);

const sky = [];
for (const s of hyg) {
  if (s.id === 0 || s.mag == null || s.mag >= SKY_MAG_LIMIT || selected.has(s.id)) continue;
  const dPc = s.distPc > 0 && s.distPc < 100000 ? s.distPc : UNKNOWN_DIST_PC;
  const absmag = s.mag - 5 * Math.log10(dPc / 10);
  const { teff } = deriveTeff(parseSpectral(s.spect), s.ci, absmag);
  sky.push(...galacticLy(s.ra, s.dec, dPc, 1), round(absmag, 2), Math.round(teff / 10) * 10);
}

const meta = {
  generated: sources.fetched,
  frame: 'galactic',
  units: { position: 'ly', teff: 'K', lum: 'L☉ (bolometric)', mass: 'M☉', radius: 'R☉' },
  sources: {
    hyg: {
      name: 'HYG Database',
      version: sources.hyg.file,
      url: 'https://codeberg.org/astronexus/hyg',
      license: 'CC BY-SA 4.0',
    },
    exoplanetArchive: {
      name: 'NASA Exoplanet Archive',
      table: 'pscomppars',
      url: 'https://exoplanetarchive.ipac.caltech.edu',
    },
  },
};

const starLines = stars.map((s) => JSON.stringify(s)).join(',\n');
await mkdir(PATHS.out, { recursive: true });
await writeFile(
  PATHS.stars,
  `{"meta":${JSON.stringify({ ...meta, maxDistLy: 50, count: stars.length, systems: members.size })},\n"stars":[\n${starLines}\n]}\n`,
);
await writeFile(
  PATHS.sky,
  JSON.stringify({
    meta: { ...meta, magLimit: SKY_MAG_LIMIT, fields: ['x', 'y', 'z', 'absmag', 'teff'], count: sky.length / 5 },
    data: sky,
  }) + '\n',
);

// ---------------------------------------------------------------------------------------------
// Report

const methods = {};
for (const { method } of matchOf.values()) methods[method] = (methods[method] ?? 0) + 1;
const inRange = hosts.filter((h) => h.distPc <= MAX_DIST_PC);
console.log(`Stars ≤ 50 ly: ${stars.length} in ${members.size} systems → ${PATHS.stars}`);
console.log(`Sky stars:     ${sky.length / 5} (V < ${SKY_MAG_LIMIT}) → ${PATHS.sky}`);
console.log(`Planet hosts ≤ 50 ly: ${inRange.length}; matched to HYG by ${JSON.stringify(methods)}`);
if (addedFromHyg.length) console.log(`  HYG stars just beyond 50 ly kept as hosts: ${addedFromHyg.join(', ')}`);
console.log(`  Added from the Archive (not in HYG): ${archiveOnly.map((h) => h.name).join(', ')}`);
if (distanceDisagreements.length) {
  console.log(`  Distance disagreements >10%:\n    ${distanceDisagreements.join('\n    ')}`);
}
const est = stars.filter((s) => s.est.includes('teff')).length;
console.log(`Temperatures estimated without a full spectral type: ${est}`);
