import { mat4 } from "gl-matrix";
import Material from "../Material";
import RenderPipeline from "../RenderPipeline";

export default interface IRenderPass {
  readonly id: string;
  readonly isCustomMaterial: boolean;
  getOutputTextures(): GPUTexture;
  getProjectionViewMatrix(): mat4;
  getRenderPassDescriptor(): GPURenderPassDescriptor;
  getRenderPipeline(): RenderPipeline;
  generateMaterial(): Material;
  getUniformProjectionViewMatrix(): GPUBuffer;
  getTextureSampler(): GPUSampler;
}