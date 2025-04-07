export type MeshDataConstructor = {
  id: string,
  textures?: { color?: ImageBitmap, normal?: ImageBitmap, emissive?: ImageBitmap, metalicRoughness?: ImageBitmap },
  samplers?: { color?: GPUSamplerDescriptor, normal?: GPUSamplerDescriptor, emissive?: GPUSamplerDescriptor, metalicRoughness?: GPUSamplerDescriptor },
  vertecies: Float32Array,
  indices: Uint32Array,
  texCoords?: Float32Array,
  normals?: Float32Array,
  tangents?: Float32Array,
}
export default class MeshData {
  private _settings: MeshDataConstructor;

  constructor(settings: MeshDataConstructor) {
    this._settings = settings;
  }

  get vertecies(): Float32Array {
    return this._settings.vertecies;
  }

  get indices(): Uint32Array {
    return this._settings.indices;
  }

  get texCoords(): Float32Array | undefined {
    return this._settings.texCoords;
  }

  get normals(): Float32Array | undefined {
    return this._settings.normals;
  }

  get tangents(): Float32Array | undefined {
    return this._settings.tangents;
  }

  get textures(): MeshDataConstructor['textures'] {
    return this._settings.textures;
  }

  get samplers(): MeshDataConstructor['samplers'] {
    return this._settings.samplers;
  }

  get id() {
    return this._settings.id;
  }
}