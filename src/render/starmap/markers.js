import {
  BufferAttribute, BufferGeometry, CanvasTexture, Group, Line, LineDashedMaterial, SRGBColorSpace,
  Sprite, SpriteMaterial,
} from 'three';

function texture(draw) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw(ctx);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

const drawDiamond = (ctx) => {
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(64, 10);
  ctx.lineTo(118, 64);
  ctx.lineTo(64, 118);
  ctx.lineTo(10, 64);
  ctx.closePath();
  ctx.stroke();
};

const drawBrackets = (ctx) => {
  ctx.lineWidth = 6;
  const near = 8;
  const far = 120;
  const arm = 30;
  for (const [x, y, dx, dy] of [[near, near, 1, 1], [far, near, -1, 1], [near, far, 1, -1], [far, far, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * arm, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * arm);
    ctx.stroke();
  }
};

const drawRing = (ctx) => {
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(64, 64, 52, 0, Math.PI * 2);
  ctx.stroke();
};

/** Screen-space markers: the ship, the selection, the hovered star, and a route line. */
export function createMarkers() {
  const group = new Group();

  const sprite = (draw, color, opacity) => {
    const s = new Sprite(
      new SpriteMaterial({
        map: texture(draw),
        color,
        opacity,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        sizeAttenuation: false,
      }),
    );
    s.renderOrder = 10;
    s.visible = false;
    group.add(s);
    return s;
  };

  const ship = sprite(drawDiamond, 0x9fd4ff, 0.95);
  const select = sprite(drawBrackets, 0xeef3fa, 0.9);
  const hover = sprite(drawRing, 0xc8d6ea, 0.5);

  const routeGeo = new BufferGeometry();
  routeGeo.setAttribute('position', new BufferAttribute(new Float32Array(6), 3));
  const routeMat = new LineDashedMaterial({
    color: 0x9fd4ff,
    transparent: true,
    opacity: 0.55,
    dashSize: 1,
    gapSize: 0.6,
    depthTest: false,
    depthWrite: false,
  });
  const route = new Line(routeGeo, routeMat);
  route.visible = false;
  route.renderOrder = 9;
  route.frustumCulled = false;
  group.add(route);

  return {
    group,
    ship,
    select,
    hover,

    /** Sprites ignore perspective (sizeAttenuation off); this sets their size in CSS pixels. */
    setPixelSize(s, px, viewportHeight, fovDeg) {
      const k = (px / viewportHeight) * 2 * Math.tan((fovDeg * Math.PI) / 360);
      s.scale.set(k, k, 1);
    },

    /** Dashed line between two scene positions, or hidden when either is null. */
    setRoute(a, b) {
      if (!a || !b) {
        route.visible = false;
        return;
      }
      routeGeo.attributes.position.array.set([a.x, a.y, a.z, b.x, b.y, b.z]);
      routeGeo.attributes.position.needsUpdate = true;
      route.computeLineDistances();
      const len = a.distanceTo(b);
      routeMat.dashSize = len / 70;
      routeMat.gapSize = len / 110;
      route.visible = true;
    },
  };
}
