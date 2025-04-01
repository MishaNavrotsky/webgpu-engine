import { vec3, mat4, quat } from "gl-matrix";
import Material from "./Material"

export type MeshConstructor = {
  id: string,
  material: Material,
  textures: { color: ImageBitmap },
  vertecies: Float32Array,
  indices: Uint32Array,
  texCoords: Float32Array,
}
export default class Mesh {
  private _settings: MeshConstructor;
  private _vTranslate: vec3 = vec3.fromValues(1, 1, 1);
  private _vRotate: vec3 = vec3.create();
  private _vOrigin: vec3 = vec3.create();
  private _vScale: vec3 = vec3.fromValues(1, 1, 1);

  constructor(settings: MeshConstructor) {
    this._settings = settings;
  }

  get vertecies(): Float32Array {
    return this._settings.vertecies;
  }

  get indices(): Uint32Array {
    return this._settings.indices;
  }

  get texCoords(): Float32Array {
    return this._settings.texCoords;
  }

  get material(): Material {
    return this._settings.material;
  }

  get textures(): MeshConstructor['textures'] {
    return this._settings.textures;
  }

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