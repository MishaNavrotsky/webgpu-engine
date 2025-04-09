import { mat4 } from "gl-matrix";
import Material from "../Material";

export default interface IRenderPass {
  readonly isCustomMaterial: boolean;
  getOutputTextures(): GPUTexture;
  getProjectionViewMatrix(): mat4;
  getRenderPassDescriptor(): GPURenderPassDescriptor;
  generateMaterial(buffers: GPUBuffer[]): Material;
}