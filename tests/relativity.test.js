import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gamma, earthYears, shipYears, travelEstimate } from '../src/sim/relativity.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('gamma is 1 at rest and 5/3 at 0.8c', () => {
  close(gamma(0), 1);
  close(gamma(0.8), 5 / 3);
  close(gamma(0.6), 1.25);
});

test('Earth time is distance over speed', () => {
  close(earthYears(4.37, 0.5), 8.74);
  close(earthYears(10, 1), 10);
});

test('ship time is Earth time divided by gamma', () => {
  // 10 ly at 0.8c: 12.5 years on Earth, 12.5 × 0.6 = 7.5 aboard.
  close(shipYears(10, 0.8), 7.5);
  close(shipYears(10, 0.6), (10 / 0.6) * 0.8);
});

test('ship time is always shorter than Earth time, and shrinks as speed rises', () => {
  let previous = Infinity;
  for (let beta = 0.5; beta < 0.995; beta += 0.01) {
    const ship = shipYears(20, beta);
    assert.ok(ship < earthYears(20, beta));
    assert.ok(ship < previous);
    previous = ship;
  }
});

test('travelEstimate bundles the numbers', () => {
  const t = travelEstimate(8.6, 0.99);
  close(t.earthYears, 8.6 / 0.99);
  close(t.shipYears, t.earthYears / t.gamma);
});
