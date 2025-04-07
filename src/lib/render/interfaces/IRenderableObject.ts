import MeshData from "../MeshData";
import IRenderable from "./IRenderable";

export default interface IRenderableObject extends IRenderable {
  getMeshData(): MeshData;
  get castShadows(): boolean;
  set castShadows(v: boolean);
  get receiveShadows(): boolean;
  set receiveShadows(v: boolean);
}