import { mat4, quat, vec3 } from "gl-matrix";


export default class ModelMatrix {
  private _vTranslate: vec3 = vec3.fromValues(1, 1, 1);
  private _vRotate: vec3 = vec3.create();
  private _vOrigin: vec3 = vec3.create();
  private _vScale: vec3 = vec3.fromValues(1, 1, 1);

  get modelMatrix() {
    const m = mat4.create()
    const qRotation = quat.fromEuler(quat.create(), this._vRotate[0], this._vRotate[1], this._vRotate[2]);
    mat4.fromRotationTranslationScaleOrigin(m, qRotation, this._vTranslate, this._vScale, this._vOrigin);

    return m;
  }

  set translation(v: vec3) {
    vec3.copy(this._vTranslate, v);
  }

  set rotation(v: vec3) {
    vec3.copy(this._vRotate, v);
  }

  set origin(v: vec3) {
    vec3.copy(this._vOrigin, v);
  }

  set scale(v: vec3) {
    vec3.copy(this._vScale, v);
  }

  get translation() {
    return vec3.clone(this._vTranslate);
  }

  get rotation() {
    return vec3.clone(this._vRotate);
  }

  get origin() {
    return vec3.clone(this._vOrigin);
  }

  get scale() {
    return vec3.clone(this._vScale);
  }
}