/** Display formatting shared by the UI and the map labels. Pure functions, no DOM. */

const LY_TO_AU = 63241.077;

export const fmtInt = (n) => Math.round(n).toLocaleString('en-US');

export function fmtLy(ly) {
  if (ly < 0.01) return `${fmtInt(ly * LY_TO_AU)} AU`;
  return `${ly < 10 ? ly.toFixed(2) : ly.toFixed(1)} ly`;
}

export function fmtDuration(years) {
  if (years < 1 / 12) return `${Math.max(1, Math.round(years * 365.25))} days`;
  if (years < 1) return `${(years * 12).toFixed(1)} months`;
  if (years < 100) return `${years.toFixed(1)} years`;
  return `${fmtInt(years)} years`;
}

export function fmtPeriod(days) {
  if (days < 1) return `${(days * 24).toFixed(1)} h orbit`;
  if (days < 365.25) return `${days < 10 ? days.toFixed(2) : days.toFixed(1)} day orbit`;
  return `${(days / 365.25).toFixed(1)} yr orbit`;
}

/** Luminosity in solar units, to two significant figures below 10. */
export function fmtLum(l) {
  if (l >= 100) return `${fmtInt(l)} L☉`;
  if (l >= 10) return `${l.toFixed(0)} L☉`;
  return `${Number(l.toPrecision(2))} L☉`;
}

export function fmtNum(x) {
  if (x >= 100) return fmtInt(x);
  if (x >= 10) return x.toFixed(1);
  return Number(x.toPrecision(3)).toString();
}

/** Spectral type for display: drops catalogue noise like trailing "..." and ":" uncertainty marks. */
export const fmtSpect = (s) => (s ?? '').replace(/[.:]+$/, '').replace(/\s{2,}/g, ' ').trim();

/** Prefix for values the catalogue marks as estimates rather than measurements. */
export const est = (star, field) => (star.est?.includes(field) ? '~' : '');

export function classFromTeff(t) {
  if (t >= 30000) return 'O';
  if (t >= 10000) return 'B';
  if (t >= 7500) return 'A';
  if (t >= 6000) return 'F';
  if (t >= 5200) return 'G';
  if (t >= 3700) return 'K';
  if (t >= 2300) return 'M';
  return 'L';
}

const COLOUR = { O: 'Blue', B: 'Blue-white', A: 'White', F: 'Yellow-white', G: 'Yellow', K: 'Orange', M: 'Red' };

/** Plain-language star type: "Red dwarf", "White dwarf", "Orange giant", … */
export function describeStar(s) {
  if (s.cls === 'D') return 'White dwarf';
  if (s.lc === 'BD' || ['L', 'T', 'Y'].includes(s.cls)) return 'Brown dwarf';
  const cls = s.cls ?? classFromTeff(s.teff);
  const colour = COLOUR[cls] ?? '';
  let kind;
  if (s.lc === 'I') kind = `${colour} supergiant`;
  else if (s.lc === 'II' || s.lc === 'III') kind = `${colour} giant`;
  else if (s.lc === 'IV') kind = `${colour} subgiant`;
  else if (s.lc === 'VI') kind = `${colour} subdwarf`;
  else if (cls === 'G' || cls === 'K' || cls === 'M') kind = `${colour} dwarf`;
  else kind = `${colour} main-sequence star`;
  return s.cls ? kind : `Probably a ${kind.toLowerCase()}`;
}

export function systemKind(sys) {
  const n = sys.members.length;
  if (n === 1) return describeStar(sys.primary);
  return ['', '', 'Binary system', 'Triple system', 'Quadruple system'][n] ?? 'Multiple-star system';
}

/** A few recognisable designations for a star: Bayer (Greek), Gliese, HD. */
export function designations(star) {
  const greek = star.aliases.find((a) => /[α-ω]/.test(a));
  const gliese = star.aliases.find((a) => /^(Gliese|GJ) /.test(a) && a !== star.name);
  const hd = star.aliases.find((a) => /^HD /.test(a) && a !== star.name);
  return [greek, gliese, hd].filter(Boolean);
}

/** "Proxima Centauri b", "55 Cancri e" (a trailing "A" on the host is dropped). */
export const planetName = (host, p) => `${host.name.replace(/\s+A$/, '')} ${p.letter}`;
