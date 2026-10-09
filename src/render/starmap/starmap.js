import { Matrix4, PerspectiveCamera, Scene, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { isCatalogueName } from '../../sim/catalog.js';
import { fmtLy } from '../../format.js';
import { blackbodyRGB } from '../color.js';
import { toScene } from '../coords.js';
import { createStarPoints } from './starPoints.js';
import { createMilkyWay } from './milkyWay.js';
import { createGrid, createStalks, GRID_LABELS } from './grid.js';
import { createMarkers } from './markers.js';
import { createLabels } from './labels.js';

const LY_PER_PC = 3.261563777;
const MAG_REF = 6.5; // matches uMagRef in the star shader
const PICK_RADIUS = 14; // CSS px
const HOME_OFFSET = new Vector3(0, 0.42, 1).normalize().multiplyScalar(30);
const FOCUS_SECONDS = 1.1;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * The 3D map of the 50-light-year neighbourhood. Selection is by system: clicking any member
 * star selects its system (identified by the primary star's id).
 *
 * Callbacks: onSelect(systemId | null), onHover(systemId | null).
 */
export function createStarmap({ canvas, labelsEl, catalog, skyData, onSelect, onHover }) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(55, 1, 0.0005, 2e5);
  camera.position.copy(HOME_OFFSET);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.9;
  controls.panSpeed = 0.7;
  controls.screenSpacePanning = true;
  controls.minDistance = 0.02;
  controls.maxDistance = 400;

  // ---- Selectable stars (≤ 50 ly)
  const stars = catalog.stars;
  const count = stars.length;
  const scenePos = stars.map((s) => toScene(s));
  const indexOf = new Map(stars.map((s, i) => [s.id, i]));
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const absMags = new Float32Array(count);
  stars.forEach((s, i) => {
    scenePos[i].toArray(positions, i * 3);
    colors.set(blackbodyRGB(s.teff), i * 3);
    absMags[i] = s.absmag;
  });
  // Map stars get an opacity floor so even faint red dwarfs stay visible and clickable.
  const near = createStarPoints({ positions, colors, absMags, sizeScale: 2.6, minSize: 3.2, minAlpha: 0.7 });
  near.renderOrder = 3;

  // ---- Background sky (naked-eye stars beyond 50 ly, non-selectable)
  const sky = skyData.data;
  const skyCount = sky.length / 5;
  const skyPositions = new Float32Array(skyCount * 3);
  const skyColors = new Float32Array(skyCount * 3);
  const skyMags = new Float32Array(skyCount);
  for (let i = 0; i < skyCount; i++) {
    const o = i * 5;
    skyPositions.set([sky[o], sky[o + 2], -sky[o + 1]], i * 3);
    skyMags[i] = sky[o + 3];
    skyColors.set(blackbodyRGB(sky[o + 4]), i * 3);
  }
  const background = createStarPoints({
    positions: skyPositions, colors: skyColors, absMags: skyMags, sizeScale: 2.4, minSize: 1.5,
  });
  background.renderOrder = 2;

  const milkyWay = createMilkyWay();
  const grid = createGrid();
  const stalks = createStalks(scenePos);
  const markers = createMarkers();
  scene.add(milkyWay, grid, stalks.object, background, near, markers.group);

  const labels = createLabels(labelsEl);

  // ---- Per-frame screen projection of every selectable star (used by picking and labels)
  const sx = new Float32Array(count);
  const sy = new Float32Array(count);
  const flux = new Float32Array(count);
  const onScreen = new Uint8Array(count);
  const viewProj = new Matrix4();
  const tmp = new Vector3();
  const dir = new Vector3();
  let width = 1;
  let height = 1;

  function project() {
    camera.updateMatrixWorld();
    viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const e = viewProj.elements;
    const c = camera.position;
    for (let i = 0; i < count; i++) {
      const p = scenePos[i];
      const w = e[3] * p.x + e[7] * p.y + e[11] * p.z + e[15];
      if (w <= 1e-6) {
        onScreen[i] = 0;
        continue;
      }
      const x = (e[0] * p.x + e[4] * p.y + e[8] * p.z + e[12]) / w;
      const y = (e[1] * p.x + e[5] * p.y + e[9] * p.z + e[13]) / w;
      sx[i] = (x * 0.5 + 0.5) * width;
      sy[i] = (0.5 - y * 0.5) * height;
      onScreen[i] = x > -1.05 && x < 1.05 && y > -1.05 && y < 1.05 ? 1 : 0;
      const distPc = Math.max(Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z) / LY_PER_PC, 1e-7);
      flux[i] = 10 ** (-0.4 * (stars[i].absmag + 5 * Math.log10(distPc) - 5 - MAG_REF));
    }
  }

  /** On-screen radius of a star's point, mirroring the shader's size rule (CSS px). */
  const drawnRadius = (i) => Math.min(Math.max(2.6 * flux[i] ** 0.3, 3), 64) / 2;

  function pick(x, y) {
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < count; i++) {
      if (!onScreen[i]) continue;
      const d = Math.hypot(sx[i] - x, sy[i] - y);
      if (d < Math.max(PICK_RADIUS, drawnRadius(i) + 4) && d < bestDist) {
        best = i;
        bestDist = d;
      }
    }
    return best < 0 ? null : stars[best].sys;
  }

  // ---- State
  let selected = null;
  let hovered = null;
  let ship = null;
  let layers = { grid: true, stalks: true, labels: true };
  let pointer = null;
  let anim = null;
  let time = 0;
  let gridFade = 1;
  let getExclusions = () => [];
  let exclusions = [];
  let exclusionAge = Infinity;

  /** Animate the orbit target to `to`, ending at distance `toLen` along direction `toDir`. */
  function glide(to, toDir, toLen) {
    const offset = camera.position.clone().sub(controls.target);
    anim = {
      from: controls.target.clone(),
      to: to.clone(),
      fromLen: offset.length(),
      fromDir: offset.normalize(),
      toDir,
      toLen,
      t: 0,
    };
  }

  const posOf = (sysId) => (sysId == null ? null : scenePos[indexOf.get(sysId)]);
  const updateRoute = () => markers.setRoute(selected !== ship ? posOf(ship) : null, posOf(selected));

  // ---- Labels
  function updateLabels() {
    labels.begin();
    const rects = [...exclusions];
    const fits = (x, y, w, h) =>
      rects.every((r) => x >= r.x + r.w || x + w <= r.x || y >= r.y + r.h || y + h <= r.y);

    // Labels start clear of the star, or of its marker sprite when it has one.
    const MARKER_RADIUS = { selected: 18, hovered: 14, ship: 12 };
    const place = (i, text, meta, kind, forced) => {
      const x = sx[i] + Math.max(drawnRadius(i), MARKER_RADIUS[kind] ?? 0) + 6;
      const y = sy[i] - 8;
      const w = (text.length + (meta ? meta.length + 2 : 0)) * 6.4 + 6;
      if (!forced && !fits(x, y, w, 15)) return false;
      rects.push({ x, y, w, h: 15 });
      labels.add(x, y, text, meta, kind);
      return true;
    };

    // Selection, hover and the ship's location are always labelled.
    const forced = new Set();
    for (const [sysId, kind] of [[selected, 'selected'], [hovered, 'hovered'], [ship, 'ship']]) {
      if (sysId == null || forced.has(sysId)) continue;
      const i = indexOf.get(sysId);
      if (!onScreen[i]) continue;
      forced.add(sysId);
      const sys = catalog.system(sysId);
      const meta = sysId === ship ? 'ship' : ship != null ? fmtLy(catalog.distance(ship, sysId)) : null;
      place(i, sys.name, meta, kind, true);
    }

    if (layers.labels) {
      // Brightest-looking first; real names beat bare catalogue numbers.
      const candidates = [];
      for (const sys of catalog.systems) {
        const i = indexOf.get(sys.id);
        if (!onScreen[i] || forced.has(sys.id)) continue;
        candidates.push({ i, sys, score: flux[i] * (isCatalogueName(sys.name) ? 1 : 8) });
      }
      candidates.sort((a, b) => b.score - a.score);
      const max = Math.min(40, Math.max(12, Math.round((width * height) / 45000)));
      let placed = 0;
      for (const c of candidates) {
        if (placed >= max) break;
        if (place(c.i, c.sys.name, null, 'star', false)) placed++;
      }
    }

    if (layers.grid && gridFade > 0.3) {
      for (const g of GRID_LABELS) {
        tmp.copy(g.pos).project(camera);
        if (tmp.z > 1 || Math.abs(tmp.x) > 1 || Math.abs(tmp.y) > 1) continue;
        labels.add((tmp.x * 0.5 + 0.5) * width + 4, (0.5 - tmp.y * 0.5) * height + 2, g.text, null, 'grid');
      }
    }
    labels.end();
  }

  function updateMarkers() {
    const show = (sprite, sysId, px) => {
      sprite.visible = sysId != null;
      if (!sprite.visible) return;
      sprite.position.copy(posOf(sysId));
      markers.setPixelSize(sprite, px, height, camera.fov);
    };
    show(markers.ship, ship, 22);
    show(markers.select, selected, 34 + Math.sin(time * 2.4) * 1.5);
    show(markers.hover, hovered !== selected ? hovered : null, 26);
  }

  // ---- Input
  let down = null;
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (moved < 5 && performance.now() - down.t < 600) onSelect?.(pick(e.clientX, e.clientY));
    down = null;
  });
  canvas.addEventListener('pointermove', (e) => {
    pointer = e.buttons ? null : { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerleave', () => {
    pointer = null;
  });
  canvas.addEventListener('dblclick', (e) => {
    const id = pick(e.clientX, e.clientY);
    if (id != null) api.focusSystem(id);
  });
  controls.addEventListener('start', () => {
    anim = null; // the user takes over mid-flight
  });

  const api = {
    scene,
    camera,

    resize(w, h, pixelRatio) {
      width = w;
      height = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      near.material.uniforms.uPixelRatio.value = pixelRatio;
      background.material.uniforms.uPixelRatio.value = pixelRatio;
      stalks.setPixelRatio(pixelRatio);
    },

    update(dt) {
      time += dt;
      if (anim) {
        anim.t = Math.min(1, anim.t + dt / FOCUS_SECONDS);
        const k = ease(anim.t);
        controls.target.lerpVectors(anim.from, anim.to, k);
        const len = anim.fromLen + (anim.toLen - anim.fromLen) * k;
        dir.copy(anim.fromDir).lerp(anim.toDir, k).normalize();
        camera.position.copy(controls.target).addScaledVector(dir, len);
        if (anim.t >= 1) anim = null;
      }
      controls.update();
      milkyWay.position.copy(camera.position);
      // Seen edge-on the rings collapse into one bright line; fade them as the camera nears the plane.
      gridFade = Math.min(1, Math.max(0, (Math.abs(camera.position.y) - 0.2) / 2.5));
      grid.userData.setFade(gridFade);
      exclusionAge += dt;
      if (exclusionAge > 0.25) {
        exclusions = getExclusions();
        exclusionAge = 0;
      }
      stalks.setFocus(controls.target, camera.position.distanceTo(controls.target));

      project();
      const hit = pointer ? pick(pointer.x, pointer.y) : null;
      if (hit !== hovered) {
        hovered = hit;
        canvas.style.cursor = hit != null ? 'pointer' : '';
        onHover?.(hit);
      }
      updateMarkers();
      updateLabels();
    },

    render(renderer) {
      renderer.render(scene, camera);
    },

    setSelected(sysId) {
      selected = sysId;
      updateRoute();
    },

    setShipSystem(sysId) {
      ship = sysId;
      updateRoute();
    },

    /** Screen rectangles ({x, y, w, h}, CSS px) that star labels should avoid, e.g. UI panels. */
    setLabelExclusions(fn) {
      getExclusions = fn;
      exclusionAge = Infinity;
    },

    setLayers(next) {
      layers = { ...layers, ...next };
      grid.visible = layers.grid;
      stalks.object.visible = layers.stalks;
    },

    /** Glide the camera to orbit a system. Keeps the viewing angle; closes in if far away. */
    focusSystem(sysId, { distance } = {}) {
      const offset = camera.position.clone().sub(controls.target);
      const fromLen = offset.length();
      glide(posOf(sysId), offset.normalize(), distance ?? Math.min(Math.max(fromLen, 2), 14));
    },

    /** Back to the default overview, centred on the ship. */
    home() {
      glide(posOf(ship) ?? new Vector3(), HOME_OFFSET.clone().normalize(), HOME_OFFSET.length());
    },

    /** Screen position (CSS px) of a system, or null if off-screen. For tests and tooling. */
    screenPosition(sysId) {
      const i = indexOf.get(sysId);
      return i != null && onScreen[i] ? { x: sx[i], y: sy[i] } : null;
    },
  };

  return api;
}
