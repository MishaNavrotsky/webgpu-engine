import { glMatrix, mat4, vec3 } from "gl-matrix";
import _ from 'lodash'
import Controls from "./Controls";

const vUp = vec3.create()
vUp[1] = 1;

class Camera {
  private _mView: mat4 = mat4.create();
  private _mProjection: mat4 = mat4.create();
  private _vLook: vec3 = vec3.create();
  private _vTranslate: vec3 = vec3.fromValues(4, 120, 230);

  private _controls: Controls;

  private _fov: number = 45;
  private _width: number = 300;
  private _height: number = 300;

  get fov() {
    return this._fov
  }

  get width() {
    return this._width

  }

  get height() {
    return this._height
  }

  set fov(v: number) {
    this.setPerspective(this._width, this._height, v);
  }

  set width(v: number) {
    this.setPerspective(v, this._height, this._fov);
  }

  set height(v: number) {
    this.setPerspective(this._width, v, this._fov);
  }

  constructor(controls: Controls) {
    this._controls = controls;
  }

  init(width: number, height: number, fov: number) {
    this._fov = fov;
    this._width = height;
    this._height = height;

    this.setPerspective(width, height, fov)
  }

  setPerspective(width: number, height: number, fov: number) {
    this._fov = fov;
    this._width = width;
    this._height = height;

    mat4.perspectiveZO(this._mProjection, glMatrix.toRadian(this._fov), this._width / this._height, 0.1, 1000);
  }

  lookAt(v: vec3) {
    vec3.copy(this._vLook, v);
  }

  get position(): vec3 {
    return vec3.clone(this._vTranslate);
  }

  set position(v: vec3) {
    this._vTranslate = vec3.clone(v);
  }

  get viewMatrix(): mat4 {
    const cloneView = mat4.clone(this._mView);
    const cloneTranslateVector = vec3.clone(this._vTranslate);
    const cloneLookVector = vec3.clone(this._vLook);
    return mat4.lookAt(cloneView, this._vTranslate, vec3.add(cloneTranslateVector, cloneTranslateVector, cloneLookVector), vUp);
  }

  get projectionMatrix(): mat4 {
    const cloneProjection = mat4.clone(this._mProjection);

    return cloneProjection;
  }

  get PVMatrix(): mat4 {
    const pv = mat4.create();
    mat4.mul(pv, this.projectionMatrix, this.viewMatrix)

    return pv;
  }

  get look(): vec3 {
    return vec3.clone(this._vLook);
  }

  private _mouseAcc = [0, 0]
  private calculateRotation(dT: number) {
    const speed = 0.001 * dT;
    const deltaMouseMovement = this._controls.dMousePos;
    this._mouseAcc[0] += deltaMouseMovement[0] * speed
    this._mouseAcc[1] -= deltaMouseMovement[1] * speed

    if (this._mouseAcc[1] > 1.55334) {
      this._mouseAcc[1] = 1.55334
    }

    if (this._mouseAcc[1] < -1.55334) {
      this._mouseAcc[1] = -1.55334
    }

    const direction = new Float32Array([0, 0, 0])
    direction[0] = Math.cos(this._mouseAcc[0]) * Math.cos(this._mouseAcc[1]);
    direction[1] = Math.sin(this._mouseAcc[1]);
    direction[2] = Math.sin(this._mouseAcc[0]) * Math.cos(this._mouseAcc[1]);
    vec3.normalize(direction, direction);
    this.lookAt(direction);
  }

  private calculatePosition(dT: number) {
    const speed = 0.22 * dT * (this._controls.keyPressed('shift') ? 8 : 1);
    const p = new Float32Array([...this._vTranslate]);
    const l = new Float32Array([...this._vLook]);

    if (this._controls.keyPressed('w')) {
      vec3.add(p, p, vec3.scale(l, l, speed))

    }

    if (this._controls.keyPressed('s')) {
      vec3.sub(p, p, vec3.scale(l, l, speed))

    }

    if (this._controls.keyPressed('a')) {
      const v = vec3.cross(l, l, [0, 1, 0]);
      const n = vec3.normalize(v, v);
      vec3.sub(p, p, vec3.scale(n, n, speed))
    }

    if (this._controls.keyPressed('d')) {
      const v = vec3.cross(l, l, [0, 1, 0]);
      const n = vec3.normalize(v, v);
      vec3.add(p, p, vec3.scale(n, n, speed))
    }

    this._vTranslate = p;
  }

  calculate(dT: number, clear?: boolean): mat4 {
    this.calculateRotation(dT);
    this.calculatePosition(dT);
    clear && this._controls.clearDeltaMouse();

    return this.PVMatrix;
  }
}

export default Camera