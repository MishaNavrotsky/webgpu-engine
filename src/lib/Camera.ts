import { glMatrix, mat4, vec3 } from "gl-matrix";
import _ from 'lodash'
import Controls from "./Controls";

const vUp = vec3.create()
vUp[1] = 1;


type CameraConstructor = {
  settings: {
    width: number,
    height: number,
    fov: number,
  }
  controls: Controls
}

class Camera {
  private view: mat4 = mat4.create();
  private projection: mat4 = mat4.create();
  private lookVector: vec3 = [0, 0, 1];
  private translateVector: vec3 = vec3.create();

  private controls: Controls;

  fov: number = 90;
  width: number = 300;
  height: number = 300;

  constructor(controls: Controls) {
    this.controls = controls;
  }

  init(width: number, height: number, fov: number) {
    this.fov = fov;
    this.width = height;
    this.height = height;

    this.setPerspective(width, height, fov)
  }

  setPerspective(width: number, height: number, fov: number) {
    this.fov = fov;
    this.width = height;
    this.height = height;

    mat4.perspectiveZO(this.projection, glMatrix.toRadian(fov), width / height, 0, Infinity);
    // mat4.orthoZO(this.projection, -2, -2, -2, 2, 0, Infinity);
  }

  lookAt(v: vec3) {
    vec3.copy(this.lookVector, v);
  }

  get position(): vec3 {
    return vec3.clone(this.translateVector);
  }

  set position(v: vec3) {
    this.translateVector = vec3.clone(v);
  }

  get viewMatrix(): mat4 {
    const cloneView = mat4.clone(this.view);
    const cloneTranslateVector = vec3.clone(this.translateVector);
    const cloneLookVector = vec3.clone(this.lookVector);
    return mat4.lookAt(cloneView, this.translateVector, vec3.add(cloneTranslateVector, cloneTranslateVector, cloneLookVector), vUp);
  }

  get projectionMatrix(): mat4 {
    const cloneProjection = mat4.clone(this.projection);

    return cloneProjection;
  }

  get PVMatrix(): mat4 {
    const pv = mat4.create();
    return mat4.mul(pv, this.projectionMatrix, this.viewMatrix)
  }

  get look(): vec3 {
    return vec3.clone(this.lookVector);
  }

  private calculateRotation(dT: number) {
    const speed = 1 * dT;
    const deltaMouseMovement = this.controls.dMousePos;
    deltaMouseMovement[0] *= speed;
    deltaMouseMovement[1] *= speed;

    if (deltaMouseMovement[1] > 1.55334) {
      deltaMouseMovement[1] = 1.55334
    }

    if (deltaMouseMovement[1] < -1.55334) {
      deltaMouseMovement[1] = -1.55334
    }

    const direction = new Float32Array([0, 0, 0])
    direction[0] = Math.cos(deltaMouseMovement[0]) * Math.cos(deltaMouseMovement[1]);
    direction[1] = Math.sin(deltaMouseMovement[1]);
    direction[2] = Math.sin(deltaMouseMovement[0]) * Math.cos(deltaMouseMovement[1]);
    vec3.normalize(direction, direction);
    this.lookAt(direction);
  }

  private calculatePosition(dT: number) {
    const speed = 0.22 * dT * (this.controls.keyPressed('shift') ? 8 : 1);
    const p = new Float32Array([...this.translateVector]);
    const l = new Float32Array([...this.lookVector]);

    if (this.controls.keyPressed('w')) {
      vec3.add(p, p, vec3.scale(l, l, speed))

    }

    if (this.controls.keyPressed('s')) {
      vec3.sub(p, p, vec3.scale(l, l, speed))

    }

    if (this.controls.keyPressed('a')) {
      const v = vec3.cross(l, l, [0, 1, 0]);
      const n = vec3.normalize(v, v);
      vec3.sub(p, p, vec3.scale(n, n, speed))
    }

    if (this.controls.keyPressed('d')) {
      const v = vec3.cross(l, l, [0, 1, 0]);
      const n = vec3.normalize(v, v);
      vec3.add(p, p, vec3.scale(n, n, speed))
    }

    this.translateVector = p;
  }

  calculate(dT: number): mat4 {
    this.calculateRotation(dT);
    this.calculatePosition(dT);

    return this.PVMatrix;
  }
}

export default Camera