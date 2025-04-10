import IRenderable from "../render/interfaces/IRenderable";
import IRenderPassLight from "../render/interfaces/IRenderPassLight";

export default class Scene {
  private _sceneRenderables: IRenderable[] = []
  private _sceneLights: IRenderPassLight[] = []
  addMesh(r: IRenderable | Array<IRenderable>) {
    if (r instanceof Array) {
      this._sceneRenderables.push(...r);
      return;
    }
    this._sceneRenderables.push(r);
  }

  addLight(l: IRenderPassLight | Array<IRenderPassLight>) {
    if (l instanceof Array) {
      this._sceneLights.push(...l);
      return;
    }
    this._sceneLights.push(l);
  }

  removeMesh(id: string) {
    this._sceneRenderables = this._sceneRenderables.filter(m => m.id != id);
  }

  removeLight(id: string) {
    this._sceneLights = this._sceneLights.filter(m => m.id != id);
  }

  get scene() {
    return { renderables: this._sceneRenderables, lights: this._sceneLights };
  }
}