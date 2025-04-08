import { mat4, vec3 } from "gl-matrix";
import BuffersData from "../BuffersData";
import IRenderableLight from "../interfaces/IRenderableLight";
import Material, { BindGroupType } from "../Material";
import { LIGHT_TYPES } from "@/constants";
import ModelMatrix from "../ModelMatrix";

export type RenderableDirectionalLightConstructor = {
  id: string,
}

export default class RenderableDirectionalLight implements IRenderableLight {
  type = LIGHT_TYPES.directional;
  private _cModelMatrix: ModelMatrix = new ModelMatrix();

  constructor(s: RenderableDirectionalLightConstructor) {
    this.id = s.id;

  }
  getDepthTexture(): GPUTexture {
    throw new Error("Method not implemented.");
  }
  getProjectionViewMatrix(): mat4 {
    throw new Error("Method not implemented.");
  }
  getModelMatrix(): mat4 {
    throw new Error("Method not implemented.");
  }
  getBuffersData(): BuffersData {
    throw new Error("Method not implemented.");
  }
  getMaterial(): Material {
    throw new Error("Method not implemented.");
  }
  swapMaterial(m: Material): void {
    throw new Error("Method not implemented.");
  }
  getBindGroupsDescriptors(grp: GPURenderPipeline): Array<BindGroupType> {
    throw new Error("Method not implemented.");
  }
  scale(v: vec3): void {
    throw new Error("Method not implemented.");
  }
  translate(v: vec3): void {
    throw new Error("Method not implemented.");
  }
  rotateDeg(v: vec3): void {
    throw new Error("Method not implemented.");
  }
  id: string;

}