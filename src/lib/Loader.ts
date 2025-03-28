import { load } from '@loaders.gl/core';
import { GLB, GLBLoader } from '@loaders.gl/gltf';

export default class Loader {
  private models: Map<string, GLB> = new Map();
  constructor() {

  }

  async load() {
    this.models.set('hand_low_poly', await load('assets/hand_low_poly.glb', GLBLoader))
    this.models.set('alicev2rigged', await load('assets/alicev2rigged.glb', GLBLoader))
  }

  get(name: string): GLB | undefined {
    return this.models.get(name);
  }
}