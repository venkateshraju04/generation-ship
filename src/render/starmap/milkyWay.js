import { BackSide, Mesh, ShaderMaterial, SphereGeometry } from 'three';
import vertexShader from '../shaders/milkyway.vert.glsl?raw';
import fragmentShader from '../shaders/milkyway.frag.glsl?raw';

/** Background sphere with the Milky Way band. Keep it centred on the camera every frame. */
export function createMilkyWay() {
  const material = new ShaderMaterial({
    uniforms: { uIntensity: { value: 0.16 } },
    vertexShader,
    fragmentShader,
    side: BackSide,
    depthWrite: false,
    depthTest: false,
  });
  const mesh = new Mesh(new SphereGeometry(1000, 96, 48), material);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}
