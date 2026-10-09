import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCatalog, normalize } from '../src/sim/catalog.js';

const load = (name) => JSON.parse(readFileSync(new URL(`../public/data/${name}`, import.meta.url), 'utf8'));
const catalog = createCatalog(load('stars.json'), load('planets.json'));
const first = (q) => catalog.search(q)[0];

test('normalize folds case, accents and superscripts', () => {
  assert.equal(normalize('Alpha¹ Centauri'), 'alpha1 centauri');
  assert.equal(normalize("Barnard's  Star"), 'barnards star');
  assert.equal(normalize('Añañuca'), 'ananuca');
});

test('search finds stars by common name, Bayer name and catalogue number', () => {
  assert.equal(first('Alpha Centauri').sysName, 'Alpha Centauri');
  assert.equal(first('Sirius').name, 'Sirius A');
  assert.equal(first('tau ceti').name, 'Tau Ceti');
  assert.equal(first('barnard').name, "Barnard's Star");
  assert.equal(first('GJ 1061').sysName, 'GJ 1061');
  assert.equal(first('trappist').name, 'TRAPPIST-1');
  assert.equal(first('Ran').name, 'Epsilon Eridani'); // IAU name kept as an alias
  assert.equal(first('sun').name, 'Sol');
});

test('systems group companions under their primary', () => {
  const sirius = catalog.systemOf(first('Sirius B').id);
  assert.equal(sirius.name, 'Sirius');
  assert.deepEqual(sirius.members.map((s) => s.name), ['Sirius A', 'Sirius B']);
  assert.equal(catalog.system(sirius.id).primary.name, 'Sirius A');
});

test('distances between stars', () => {
  const sol = first('Sol');
  const sirius = first('Sirius');
  assert.ok(Math.abs(catalog.distance(sol.id, sirius.id) - 8.6) < 0.05);
  assert.equal(catalog.distance(sirius.id, sirius.id), 0);
});

test('systems carry their confirmed planets', () => {
  const trappist = catalog.systemOf(first('TRAPPIST-1').id);
  assert.equal(trappist.planets.length, 7);
  assert.ok(trappist.planets.every((p) => p.starId === trappist.id));
});
