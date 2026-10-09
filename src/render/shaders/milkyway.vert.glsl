varying vec3 vDir;

void main() {
  vDir = position; // the sphere is centred on the camera, so this is the view direction
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
