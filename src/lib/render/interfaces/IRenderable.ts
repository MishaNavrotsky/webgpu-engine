import { mat4, vec3 } from "gl-matrix";
import Material, { BindGroupType } from "../Material";
import BuffersData from "../BuffersData";

export default interface IRenderable {
  getModelMatrix(): mat4;
  getBuffersData(): BuffersData;
  getMaterial(): Material;
  swapMaterial(m: Material): void;
  getBindGroupsDescriptors(grp: GPURenderPipeline): Array<BindGroupType>;

  scale(v: vec3): void;
  translate(v: vec3): void;
  rotateDeg(v: vec3): void;

  readonly id: string;
}