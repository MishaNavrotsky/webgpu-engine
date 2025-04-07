import { LIGHT_TYPES } from "@/constants";
import IRenderable from "./IRenderable";
import { mat4 } from "gl-matrix";

export default interface IRenderableLight extends IRenderable {
  readonly type: typeof LIGHT_TYPES[number]
  readonly depthTexture: GPUTexture

  getProjectionViewMatrix(): mat4;
}