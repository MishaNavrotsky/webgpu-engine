import IRenderable from "../render/interfaces/IRenderable";

export default class Scene {
  private _sceneRenderables: IRenderable[] = []
  addMesh(r: IRenderable | Array<IRenderable>) {
    if (r instanceof Array) {
      this._sceneRenderables.push(...r);
      return;
    }
    this._sceneRenderables.push(r);
  }

  removeMesh(id: string) {
    this._sceneRenderables = this._sceneRenderables.filter(m => m.id != id);
  }

  get scene() {
    return this._sceneRenderables;
  }
}