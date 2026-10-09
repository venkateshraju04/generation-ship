import {
  BufferAttribute, BufferGeometry, Group, LineBasicMaterial, LineLoop, LineSegments, Points,
  ShaderMaterial, Vector3,
} from 'three';
import { longitudeDirection } from '../coords.js';
import vertexShader from '../shaders/fade.vert.glsl?raw';
import fragmentShader from '../shaders/fade.frag.glsl?raw';

const RING_STEP = 10;
const RING_MAX = 50;

/**
 * Distance rings every 10 ly in the galactic plane around the Sun, plus faint longitude spokes.
 * setFade(f) scales their opacity, e.g. to hide the grid when the camera is nearly edge-on.
 */
export function createGrid() {
  const group = new Group();
  const base = new Map();
  const material = (color, opacity) => {
    const m = new LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    base.set(m, opacity);
    return m;
  };
  const ring = material(0x6f86b0, 0.16);
  const outer = material(0x7f96c0, 0.3);
  const spoke = material(0x6f86b0, 0.07);

  const SEGMENTS = 256;
  for (let r = RING_STEP; r <= RING_MAX; r += RING_STEP) {
    const pts = new Float32Array(SEGMENTS * 3);
    for (let i = 0; i < SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2;
      pts.set([r * Math.cos(a), 0, r * Math.sin(a)], i * 3);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pts, 3));
    group.add(new LineLoop(geo, r === RING_MAX ? outer : ring));
  }

  const spokes = [];
  const dir = new Vector3();
  for (let l = 0; l < 360; l += 30) {
    longitudeDirection(l, dir);
    spokes.push(dir.x * 2, 0, dir.z * 2, dir.x * RING_MAX, 0, dir.z * RING_MAX);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(spokes), 3));
  group.add(new LineSegments(geo, spoke));

  group.renderOrder = 0;
  group.userData.setFade = (f) => {
    for (const [m, opacity] of base) m.opacity = opacity * f;
  };
  return group;
}

/** Text anchors for the grid: ring distances (along longitude 270°) and the galactic centre. */
export const GRID_LABELS = [
  ...[10, 20, 30, 40, 50].map((r) => ({ text: `${r} ly`, pos: longitudeDirection(270).multiplyScalar(r) })),
  { text: 'toward galactic centre', pos: longitudeDirection(0).multiplyScalar(RING_MAX + 4) },
];

/**
 * A vertical line from each star to the galactic plane, with a dot at its foot — the classic
 * 3D starmap depth cue. Blue above the plane, amber below. Fades with distance from the focus.
 */
export function createStalks(points) {
  const n = points.length;
  const linePos = new Float32Array(n * 6);
  const lineTint = new Float32Array(n * 6);
  const footPos = new Float32Array(n * 3);
  const footTint = new Float32Array(n * 3);
  const above = [0.49, 0.61, 0.78];
  const below = [0.71, 0.6, 0.44];

  points.forEach((p, i) => {
    const t = p.y >= 0 ? above : below;
    linePos.set([p.x, p.y, p.z, p.x, 0, p.z], i * 6);
    lineTint.set([...t, ...t], i * 6);
    footPos.set([p.x, 0, p.z], i * 3);
    footTint.set(t, i * 3);
  });

  const shared = {
    uFocus: { value: new Vector3() },
    uRadius: { value: 30 },
    uPixelRatio: { value: 1 },
  };
  const material = (opacity) =>
    new ShaderMaterial({
      uniforms: { ...shared, uOpacity: { value: opacity } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });

  const lineGeo = new BufferGeometry();
  lineGeo.setAttribute('position', new BufferAttribute(linePos, 3));
  lineGeo.setAttribute('tint', new BufferAttribute(lineTint, 3));
  const lines = new LineSegments(lineGeo, material(0.13));

  const footGeo = new BufferGeometry();
  footGeo.setAttribute('position', new BufferAttribute(footPos, 3));
  footGeo.setAttribute('tint', new BufferAttribute(footTint, 3));
  const feet = new Points(footGeo, material(0.4));

  const object = new Group();
  object.add(lines, feet);
  object.renderOrder = 1;
  for (const o of [lines, feet]) o.frustumCulled = false;

  return {
    object,
    /** Fade lines beyond a radius that grows as the camera pulls back from its target. */
    setFocus(target, cameraDistance) {
      shared.uFocus.value.copy(target);
      shared.uRadius.value = Math.max(4, cameraDistance * 0.6);
    },
    setPixelRatio(pr) {
      shared.uPixelRatio.value = pr;
    },
  };
}
