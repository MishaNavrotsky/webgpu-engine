import Material, { BindGroupType } from "../Material";
import BuffersData from "../BuffersData";
import IModelPosition from "./IModelPosition";

export default interface IRenderable extends IModelPosition {
  getBuffersData(): BuffersData;
  getMaterial(): Material;
  swapMaterial(m: Material): void;
  getBindGroupsDescriptors(grp: GPURenderPipeline): Array<BindGroupType>;

  readonly id: string;
}