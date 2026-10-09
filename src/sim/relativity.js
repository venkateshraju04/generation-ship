/**
 * Special relativity for a constant-speed cruise. Speeds are β = v/c, distances in light-years,
 * durations in years. Acceleration and braking phases are not modelled.
 */

/** Lorentz factor γ = 1 / √(1 − β²). */
export const gamma = (beta) => 1 / Math.sqrt(1 - beta * beta);

/** Duration in the Earth (rest) frame: distance / speed. */
export const earthYears = (distanceLy, beta) => distanceLy / beta;

/** Duration aboard the ship (proper time): Earth time × √(1 − β²). */
export const shipYears = (distanceLy, beta) => earthYears(distanceLy, beta) * Math.sqrt(1 - beta * beta);

export function travelEstimate(distanceLy, beta) {
  return {
    distanceLy,
    beta,
    gamma: gamma(beta),
    earthYears: earthYears(distanceLy, beta),
    shipYears: shipYears(distanceLy, beta),
  };
}
