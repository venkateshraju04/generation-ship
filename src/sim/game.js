/**
 * The voyage's persistent state. Plain data only, so it can be saved as JSON.
 * Time is tracked twice: in the Earth frame (calendar years since launch) and aboard the ship.
 */
import { LAUNCH_YEAR, SOL_ID, GENERATION_YEARS } from './constants.js';

export function newGame() {
  return {
    version: 1,
    launchYear: LAUNCH_YEAR,
    earthYears: 0,
    shipYears: 0,
    locationId: SOL_ID,
    visited: [SOL_ID],
  };
}

/** Current calendar year on Earth. */
export const earthYear = (g) => g.launchYear + g.earthYears;

/** Crew generation aboard (1 at launch). */
export const generation = (g) => 1 + Math.floor(g.shipYears / GENERATION_YEARS);
