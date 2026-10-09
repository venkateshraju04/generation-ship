import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const LY_PER_PC = 3.261563777;

/** Stars within this distance of the Sun are selectable in the game. */
export const MAX_DIST_LY = 50;
export const MAX_DIST_PC = MAX_DIST_LY / LY_PER_PC;

/** Faintest apparent magnitude (as seen from Earth) kept for the background sky. */
export const SKY_MAG_LIMIT = 6.5;

/** Stars with no usable parallax are placed this far away in the background sky. */
export const UNKNOWN_DIST_PC = 1000;

export const PATHS = {
  root: ROOT,
  raw: join(ROOT, 'data', 'raw'),
  rawHyg: join(ROOT, 'data', 'raw', 'hyg.csv.gz'),
  rawPlanets: join(ROOT, 'data', 'raw', 'pscomppars.csv'),
  rawSources: join(ROOT, 'data', 'raw', 'sources.json'),
  curated: join(ROOT, 'data', 'curated'),
  out: join(ROOT, 'public', 'data'),
  stars: join(ROOT, 'public', 'data', 'stars.json'),
  sky: join(ROOT, 'public', 'data', 'sky.json'),
  planets: join(ROOT, 'public', 'data', 'planets.json'),
};
