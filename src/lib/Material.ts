export type MaterialConstructor = {
  id: string,
  shaderModule: GPUShaderModule,
  textures: Array<GPUTexture>,
  uniformBuffers: Array<GPUBuffer>,
}

export default class Material {
  private _compiledShader: GPUShaderModule;
  private _textures: Array<GPUTexture>;
  private _uniformBuffers: Array<GPUBuffer>;

  constructor(settings: MaterialConstructor) {
    this._compiledShader = settings.shaderModule;
    this._textures = settings.textures;
    this._uniformBuffers = settings.uniformBuffers;
  }

  get shaderModule() {
    return this._compiledShader;
  }

  get textures() {
    return this._textures;
  }

  get uniformBuffers() {
    return this._uniformBuffers;
  }
}