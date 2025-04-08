import { LIGHT_TYPES } from "@/constants";
import IRenderable from "./IRenderable";
import { mat4 } from "gl-matrix";

export default interface IRenderableLight extends IRenderable {
  readonly type: typeof LIGHT_TYPES[keyof typeof LIGHT_TYPES]

  getDepthTexture(): GPUTexture;
  getProjectionViewMatrix(): mat4;
}