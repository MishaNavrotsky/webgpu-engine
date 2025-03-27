import { load } from '@loaders.gl/core';
import { GLB, GLBLoader } from '@loaders.gl/gltf';

export default class Loader {
  private models: Map<string, GLB> = new Map();
  constructor() {

  }

  async load() {
    const s = await load('assets/hand_low_poly.glb', GLBLoader)
    this.models.set('hand_low_poly', s);
  }

  get(name: string): GLB | undefined {
    return this.models.get(name);
  }
}