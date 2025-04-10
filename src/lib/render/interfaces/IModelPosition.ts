import { vec3, mat4 } from "gl-matrix";

export default interface IModelPosition {
  getModelMatrix(): mat4;

  scale(v: vec3): void;
  translate(v: vec3): void;
  rotateDeg(v: vec3): void;

  getScale(): vec3;
  getRotationDeg(): vec3;
  getPosition(): vec3;
}