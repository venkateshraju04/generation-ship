import { Vector3 } from 'three';

/**
 * Catalogue positions are galactic Cartesian light-years (x → galactic centre, y → l = 90°,
 * z → north galactic pole). The scene is Y-up, so the galactic plane lies flat:
 * scene = (x, z, −y). That is a proper rotation, so handedness is preserved.
 */
export function toScene(star, out = new Vector3()) {
  return out.set(star.x, star.z, -star.y);
}

/** Scene direction of a galactic longitude (degrees) in the galactic plane. */
export function longitudeDirection(lDeg, out = new Vector3()) {
  const l = (lDeg * Math.PI) / 180;
  return out.set(Math.cos(l), 0, -Math.sin(l));
}
