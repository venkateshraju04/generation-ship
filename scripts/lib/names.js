/** Star designations: Bayer (Greek letter + constellation), Flamsteed (number + constellation), Gliese. */

const GREEK = {
  Alp: ['α', 'Alpha'], Bet: ['β', 'Beta'], Gam: ['γ', 'Gamma'], Del: ['δ', 'Delta'],
  Eps: ['ε', 'Epsilon'], Zet: ['ζ', 'Zeta'], Eta: ['η', 'Eta'], The: ['θ', 'Theta'],
  Iot: ['ι', 'Iota'], Kap: ['κ', 'Kappa'], Lam: ['λ', 'Lambda'], Mu: ['μ', 'Mu'],
  Nu: ['ν', 'Nu'], Xi: ['ξ', 'Xi'], Omi: ['ο', 'Omicron'], Pi: ['π', 'Pi'],
  Rho: ['ρ', 'Rho'], Sig: ['σ', 'Sigma'], Tau: ['τ', 'Tau'], Ups: ['υ', 'Upsilon'],
  Phi: ['φ', 'Phi'], Chi: ['χ', 'Chi'], Psi: ['ψ', 'Psi'], Ome: ['ω', 'Omega'],
};

const SUPERSCRIPT = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

/** IAU constellation abbreviation → Latin genitive. */
export const GENITIVE = {
  And: 'Andromedae', Ant: 'Antliae', Aps: 'Apodis', Aqr: 'Aquarii', Aql: 'Aquilae', Ara: 'Arae',
  Ari: 'Arietis', Aur: 'Aurigae', Boo: 'Boötis', Cae: 'Caeli', Cam: 'Camelopardalis',
  Cnc: 'Cancri', CVn: 'Canum Venaticorum', CMa: 'Canis Majoris', CMi: 'Canis Minoris',
  Cap: 'Capricorni', Car: 'Carinae', Cas: 'Cassiopeiae', Cen: 'Centauri', Cep: 'Cephei',
  Cet: 'Ceti', Cha: 'Chamaeleontis', Cir: 'Circini', Col: 'Columbae', Com: 'Comae Berenices',
  CrA: 'Coronae Australis', CrB: 'Coronae Borealis', Crv: 'Corvi', Crt: 'Crateris',
  Cru: 'Crucis', Cyg: 'Cygni', Del: 'Delphini', Dor: 'Doradus', Dra: 'Draconis',
  Equ: 'Equulei', Eri: 'Eridani', For: 'Fornacis', Gem: 'Geminorum', Gru: 'Gruis',
  Her: 'Herculis', Hor: 'Horologii', Hya: 'Hydrae', Hyi: 'Hydri', Ind: 'Indi',
  Lac: 'Lacertae', Leo: 'Leonis', LMi: 'Leonis Minoris', Lep: 'Leporis', Lib: 'Librae',
  Lup: 'Lupi', Lyn: 'Lyncis', Lyr: 'Lyrae', Men: 'Mensae', Mic: 'Microscopii',
  Mon: 'Monocerotis', Mus: 'Muscae', Nor: 'Normae', Oct: 'Octantis', Oph: 'Ophiuchi',
  Ori: 'Orionis', Pav: 'Pavonis', Peg: 'Pegasi', Per: 'Persei', Phe: 'Phoenicis',
  Pic: 'Pictoris', Psc: 'Piscium', PsA: 'Piscis Austrini', Pup: 'Puppis', Pyx: 'Pyxidis',
  Ret: 'Reticuli', Sge: 'Sagittae', Sgr: 'Sagittarii', Sco: 'Scorpii', Scl: 'Sculptoris',
  Sct: 'Scuti', Ser: 'Serpentis', Sex: 'Sextantis', Tau: 'Tauri', Tel: 'Telescopii',
  Tri: 'Trianguli', TrA: 'Trianguli Australis', Tuc: 'Tucanae', UMa: 'Ursae Majoris',
  UMi: 'Ursae Minoris', Vel: 'Velorum', Vir: 'Virginis', Vol: 'Volantis', Vul: 'Vulpeculae',
};

/**
 * HYG Bayer field ("Alp", "Tau-1", "Omi-2", or a Latin letter like "p") → names.
 * Returns { greek: "ο² Eridani", spelled: "Omicron² Eridani" } or null.
 */
export function bayerNames(bayer, con) {
  if (!bayer || !con || !GENITIVE[con]) return null;
  const [letter, index] = bayer.split('-');
  const sup = index ? [...index].map((d) => SUPERSCRIPT[+d] ?? d).join('') : '';
  const gen = GENITIVE[con];
  const g = GREEK[letter];
  if (!g) return { greek: `${letter}${sup} ${gen}`, spelled: `${letter}${sup} ${gen}` };
  return { greek: `${g[0]}${sup} ${gen}`, spelled: `${g[1]}${sup} ${gen}` };
}

export function flamsteedName(flam, con) {
  return flam && GENITIVE[con] ? `${flam} ${GENITIVE[con]}` : null;
}

/** Normalised Gliese key: "Gl 559A", "GJ 667 C", "Gliese 12" → "559A", "667C", "12". */
export function glKey(s) {
  const m = s?.trim().match(/^(?:GJ|Gl|Gliese)\s*(\d+(?:\.\d+)?)\s*([A-Za-z]{0,2})$/i);
  return m ? m[1] + m[2].toUpperCase() : null;
}

/** Component letter from a Gliese designation ("Gl 559A" → "A"), or null. */
export function glComponent(s) {
  const k = glKey(s);
  const m = k?.match(/([A-Z]+)$/);
  return m ? m[1] : null;
}

/** Human-readable Gliese name: "Gl 559A" → "Gliese 559 A", "GJ 1061" → "GJ 1061". */
export function glDisplay(s) {
  const m = s?.trim().match(/^(GJ|Gl)\s*(\d+(?:\.\d+)?)\s*([A-Za-z]{0,2})$/);
  if (!m) return s?.trim() || null;
  const prefix = m[1] === 'Gl' ? 'Gliese' : 'GJ';
  return `${prefix} ${m[2]}${m[3] ? ` ${m[3].toUpperCase()}` : ''}`;
}

// SIMBAD-style lowercase Greek abbreviations used by the Exoplanet Archive ("eps Eri", "tau Cet").
const GREEK_ABBR = {
  alf: 'Alpha', bet: 'Beta', gam: 'Gamma', del: 'Delta', eps: 'Epsilon', zet: 'Zeta', eta: 'Eta',
  tet: 'Theta', iot: 'Iota', kap: 'Kappa', lam: 'Lambda', mu: 'Mu', nu: 'Nu', ksi: 'Xi', omi: 'Omicron',
  pi: 'Pi', rho: 'Rho', sig: 'Sigma', tau: 'Tau', ups: 'Upsilon', phi: 'Phi', chi: 'Chi', psi: 'Psi',
  ome: 'Omega',
};

/**
 * Expands abbreviated Bayer/Flamsteed designations: "55 Cnc B" → "55 Cancri B",
 * "eps Ind A" → "Epsilon Indi A". Anything else is returned unchanged.
 */
export function expandDesignation(name) {
  const m = name.match(/^([A-Za-z]{2,3}|\d{1,3})(\d)?\s+([A-Z][A-Za-z]{1,2})(\s+[A-C])?$/);
  if (!m || !GENITIVE[m[3]]) return name;
  const [, head, index, con, comp = ''] = m;
  const lead = /^\d+$/.test(head) ? head : GREEK_ABBR[head.toLowerCase()];
  if (!lead) return name;
  const sup = index ? SUPERSCRIPT[+index] : '';
  return `${lead}${sup} ${GENITIVE[con]}${comp}`;
}

/** Strips a trailing component letter: "Sirius A" → "Sirius", "Gliese 667 C" → "Gliese 667". */
export const stripComponent = (name) => name.replace(/\s+[A-C]$/, '');
