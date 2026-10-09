import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blackbodyRGB } from '../src/render/color.js';

const one = (x) => assert.ok(Math.abs(x - 1) < 1e-9, `${x} ≈ 1`);

test('cool stars are red-orange: red channel saturated, blue weak', () => {
  const [r, g, b] = blackbodyRGB(3000);
  one(r);
  assert.ok(g < 0.85 && b < 0.6, `${g}, ${b}`);
});

test('the Sun is a near-white with a slight warm cast', () => {
  const [r, g, b] = blackbodyRGB(5772);
  one(r);
  assert.ok(g > 0.9 && b > 0.8 && b < g, `${g}, ${b}`);
});

test('hot stars are blue-white: blue channel saturated', () => {
  const [r, g, b] = blackbodyRGB(25000);
  one(b);
  assert.ok(r < g && g < b);
});

test('colour shifts monotonically from red toward blue with temperature', () => {
  let lastRatio = 0;
  for (let t = 2000; t <= 30000; t += 500) {
    const [r, , b] = blackbodyRGB(t);
    const ratio = b / r;
    assert.ok(ratio >= lastRatio, `b/r should not fall at ${t} K`);
    lastRatio = ratio;
  }
});
