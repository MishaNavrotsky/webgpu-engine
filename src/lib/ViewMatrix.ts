import { mat4, vec3 } from "gl-matrix";

const vUp = vec3.create();
vUp[1] = 1;

export default class ViewMatrix {
  private _eye: vec3 = vec3.create();
  private _center: vec3 = vec3.create();


  get viewMatrix() {
    return mat4.lookAt(mat4.create(), this._eye, this._center, vUp);
  }

  get eye() {
    return this._eye;
  }
  set eye(v: vec3) {
    this._eye = v;
  }
  get center() {
    return this._center;
  }
  set center(v: vec3) {
    this._center = v;
  }
  get vUp() {
    return vec3.clone(vUp);
  }
}