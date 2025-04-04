import Mesh from "./Mesh";

export default class Scene {
  private _sceneMeshes: Mesh[] = []
  addMesh(mesh: Mesh | Array<Mesh>) {
    if (mesh instanceof Array) {
      this._sceneMeshes.push(...mesh);
      return;
    }
    this._sceneMeshes.push(mesh);
  }

  removeMesh(id: string) {
    this._sceneMeshes = this._sceneMeshes.filter(m => m.id != id);
  }

  get meshes() {
    return this._sceneMeshes;
  }
}