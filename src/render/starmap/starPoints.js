import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial } from 'three';
import vertexShader from '../shaders/stars.vert.glsl?raw';
import fragmentShader from '../shaders/stars.frag.glsl?raw';

/**
 * A point cloud of stars drawn by apparent magnitude (see stars.vert.glsl).
 * positions/colors are Float32Array xyz/rgb triples; absMags one value per star.
 */
export function createStarPoints({ positions, colors, absMags, sizeScale, minSize, maxSize = 64, minAlpha = 0 }) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('starColor', new BufferAttribute(colors, 3));
  geometry.setAttribute('absMag', new BufferAttribute(absMags, 1));

  const material = new ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: 1 },
      uSizeScale: { value: sizeScale },
      uMinSize: { value: minSize },
      uMaxSize: { value: maxSize },
      uMinAlpha: { value: minAlpha },
      uMagRef: { value: 6.5 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return points;
}
