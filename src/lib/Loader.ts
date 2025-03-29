import { load } from '@loaders.gl/core';
import { GLB, GLBLoader } from '@loaders.gl/gltf';

export default class Loader {
  private _GLBEntries: Map<string, GLB> = new Map();
  private _shaderEntries: Map<string, string> = new Map();

  constructor() {

  }

  private getGLBId(id: string) {
    return `GLB/${id}`
  }

  private getShaderId(id: string) {
    return `Shader/${id}`
  }

  async loadGLB(id: string, path: string) {
    this._GLBEntries.set(this.getGLBId(id), await load(path, GLBLoader))
  }

  async loadShader(id: string, path: string) {
    this._shaderEntries.set(this.getShaderId(id), await (await fetch(path)).text());
  }

  getGLB(id: string): GLB | undefined {
    return this._GLBEntries.get(this.getGLBId(id));
  }

  getShader(id: string): string | undefined {
    return this._shaderEntries.get(this.getShaderId(id))
  }
}