import { LIGHT_TYPES } from "@/constants";
import IRenderPass from "./IRenderPass";

export default interface IRenderPassLight extends IRenderPass {
  readonly type: typeof LIGHT_TYPES[keyof typeof LIGHT_TYPES]

}