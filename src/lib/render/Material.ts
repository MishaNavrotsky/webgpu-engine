import { TEXTURE_SAMPLERS_IDS, TEXTURE_IDS, TEX_DEF_SEQUENCE, SAMPLERS_DEF_SEQUENCE } from "@/constants";
import _ from 'lodash';
import RenderPipeline from "./RenderPipeline";
import { vec3, vec4 } from "gl-matrix";

export type MaterialConstructor = {
  id: string,
  renderPipeline: RenderPipeline,

  colorTexture?: GPUTexture,
  emissiveTexture?: GPUTexture,
  metalicRoughnessTexture?: GPUTexture,
  normalTexture?: GPUTexture,
  occlusionTexture?: GPUTexture,

  colorSampler?: GPUSampler,
  emissiveSampler?: GPUSampler,
  metalicRoughnessSampler?: GPUSampler,
  normalSampler?: GPUSampler,
  occlusionSampler?: GPUSampler,

  textures?: Array<GPUTexture>,
  samplers?: Array<GPUSampler>,
  uniformBuffers?: Array<GPUBuffer>,

  factors?: {
    metallic?: number,
    roughness?: number
    occlusion?: number,
    baseColor?: vec4,
    emissive?: vec3,
  }
}

export type BindGroupType = {
  index: number, description: GPUBindGroupDescriptor
}

export default class Material {
  private _s: MaterialConstructor;

  constructor(settings: MaterialConstructor) {
    this._s = settings;
  }

  get textures() {
    return this._s.textures;
  }

  get allTextures() {
    return [...TEX_DEF_SEQUENCE.map(id => this._s[id]).filter(t => t != undefined), ...this.textures || []]
  }

  get uniformBuffers() {
    return this._s.uniformBuffers;
  }

  get samplers() {
    return this._s.samplers;
  }

  get allSamplers() {
    return [...SAMPLERS_DEF_SEQUENCE.map(id => this._s[id]).filter(s => s != undefined), ...this.samplers || []]
  }

  get renderPipeline() {
    return this._s.renderPipeline
  }

  get colorTexture() {
    return this._s.colorTexture;
  }
  get emissiveTexture() {
    return this._s.emissiveTexture;
  }
  get metalicRoughnessTexture() {
    return this._s.metalicRoughnessTexture;
  }
  get normalTexture() {
    return this._s.normalTexture;
  }
  get occlusionTexture() {
    return this._s.occlusionTexture;
  }

  get colorSampler() {
    return this._s.colorSampler;
  }
  get emissiveSampler() {
    return this._s.emissiveSampler;
  }
  get metalicRoughnessSampler() {
    return this._s.metalicRoughnessSampler;
  }
  get normalSampler() {
    return this._s.normalSampler;
  }
  get occlusionSampler() {
    return this._s.occlusionSampler;
  }

  get factors() {
    return {
      metallic: this._s.factors?.metallic ?? 1,
      roughness: this._s.factors?.roughness ?? 1,
      occlusion: this._s.factors?.occlusion ?? 1,
      baseColor: this._s.factors?.baseColor ?? [1, 1, 1, 1],
      emissive: this._s.factors?.emissive ?? [0, 0, 0, 0],
    }
  }


  swapTextures(texs: GPUTexture[]) {
    this._s.textures = texs;
  }
  swapColorTexture(tex: GPUTexture) {
    this._s.colorTexture = tex;
  }
  swapEmissiveTexture(tex: GPUTexture) {
    this._s.emissiveTexture = tex;
  }
  swapMetalicRoughnessTexture(tex: GPUTexture) {
    this._s.metalicRoughnessTexture = tex;
  }
  swapNormalTexture(tex: GPUTexture) {
    this._s.normalTexture = tex;
  }
  swapOcclusionTexture(tex: GPUTexture) {
    this._s.occlusionTexture = tex;
  }

  swapSamplers(samplers: GPUSampler[]) {
    this._s.samplers = samplers;
  }

  swapColorSampler(sampler: GPUSampler) {
    this._s.colorSampler = sampler;
  }
  swapEmissiveSampler(sampler: GPUSampler) {
    this._s.emissiveSampler = sampler;
  }
  swapMetalicRoughnessSampler(sampler: GPUSampler) {
    this._s.metalicRoughnessSampler = sampler;
  }
  swapNormalSampler(sampler: GPUSampler) {
    this._s.normalSampler = sampler;
  }
  swapOcclusionSampler(sampler: GPUSampler) {
    this._s.occlusionSampler = sampler;
  }

  swapUniformBuffers(ubs: GPUBuffer[]) {
    this._s.uniformBuffers = ubs;
  }

  static _initialized = false;
  static _zeroedTextures: { [key in keyof typeof TEXTURE_IDS]: GPUTexture };
  static _zeroedSamplers: { [key in keyof typeof TEXTURE_SAMPLERS_IDS]: GPUSampler };


  static setContext(device: GPUDevice) {
    if (this._initialized) return
    const texSettings = (label: string): GPUTextureDescriptor => ({
      format: 'rgba8unorm',
      size: [1, 1, 1],
      usage: GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST,
      dimension: '2d',
      label
    });
    this._zeroedTextures = {
      colorTexture: device.createTexture(texSettings(TEXTURE_IDS.colorTexture)),
      emissiveTexture: device.createTexture(texSettings(TEXTURE_IDS.emissiveTexture)),
      metalicRoughnessTexture: device.createTexture(texSettings(TEXTURE_IDS.metalicRoughnessTexture)),
      normalTexture: device.createTexture(texSettings(TEXTURE_IDS.normalTexture)),
      occlusionTexture: device.createTexture(texSettings(TEXTURE_IDS.occlusionTexture)),
    }
    device.queue.writeTexture({ texture: this._zeroedTextures.colorTexture }, new Uint8Array([255, 255, 255, 0]), {}, { width: 1, height: 1 })
    device.queue.writeTexture({ texture: this._zeroedTextures.emissiveTexture }, new Uint8Array([255, 255, 255, 0]), {}, { width: 1, height: 1 })
    device.queue.writeTexture({ texture: this._zeroedTextures.metalicRoughnessTexture }, new Uint8Array([0, 255, 255, 0]), {}, { width: 1, height: 1 })
    device.queue.writeTexture({ texture: this._zeroedTextures.normalTexture }, new Uint8Array([0, 0, 0, 0]), {}, { width: 1, height: 1 })
    device.queue.writeTexture({ texture: this._zeroedTextures.occlusionTexture }, new Uint8Array([255, 255, 255, 255]), {}, { width: 1, height: 1 })

    this._zeroedSamplers = {
      colorSampler: device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', label: TEXTURE_SAMPLERS_IDS.colorSampler }),
      emissiveSampler: device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', label: TEXTURE_SAMPLERS_IDS.emissiveSampler }),
      metalicRoughnessSampler: device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', label: TEXTURE_SAMPLERS_IDS.metalicRoughnessSampler }),
      normalSampler: device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', label: TEXTURE_SAMPLERS_IDS.normalSampler }),
      occlusionSampler: device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', label: TEXTURE_SAMPLERS_IDS.occlusionSampler }),
    }

    this._initialized = true;
  }

  static create(s: MaterialConstructor, device: GPUDevice): Material {
    this.setContext(device);
    const mSettings: MaterialConstructor = {
      ...s,
      colorTexture: s.colorTexture || this._zeroedTextures.colorTexture,
      normalTexture: s.normalTexture || this._zeroedTextures.normalTexture,
      emissiveTexture: s.emissiveTexture || this._zeroedTextures.emissiveTexture,
      metalicRoughnessTexture: s.metalicRoughnessTexture || this._zeroedTextures.metalicRoughnessTexture,
      occlusionTexture: s.occlusionTexture || this._zeroedTextures.occlusionTexture,

      colorSampler: s.colorSampler || this._zeroedSamplers.colorSampler,
      normalSampler: s.normalSampler || this._zeroedSamplers.normalSampler,
      emissiveSampler: s.emissiveSampler || this._zeroedSamplers.colorSampler,
      metalicRoughnessSampler: s.metalicRoughnessSampler || this._zeroedSamplers.metalicRoughnessSampler,
      occlusionSampler: s.occlusionSampler || this._zeroedSamplers.occlusionSampler,

      textures: s.textures,
      samplers: s.samplers,
      renderPipeline: s.renderPipeline,
    }

    return new Material(mSettings)
  }
}