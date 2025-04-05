import { DEPTH_STENCIL_FORMAT, MULTISAMPLE_COUNT, TEXTURE_SAMPLERS_IDS, VERTEX_BUFFER_IDS, TEXTURE_IDS, VERTEX_BUFFER_SIZES, VERTEX_BUFFER_SIZES_FORMAT } from "@/constants";
import _ from 'lodash';
import VBSG from "./VertexBuffersStateGenerator";

export type MaterialConstructor = {
  id: string,
  shaderModule: GPUShaderModule,
  textures: Array<GPUTexture>,
  uniformBuffers: Array<GPUBuffer>,
  samplers: Array<GPUSampler>,
  vertexBuffers: Array<GPUBuffer>,
  vertexBuffersState: (GPUVertexBufferLayout & { label: string })[],
  indicesBuffer: GPUBuffer | null,
  fragmentFormat?: GPUTextureFormat,
  fragmentTargets?: Array<GPUColorTargetState>,
}

export type BindGroupType = {
  index: number, description: GPUBindGroupDescriptor
}

export default class Material {
  private _compiledShader: GPUShaderModule;
  private _textures: Array<GPUTexture>;
  private _samplers: Array<GPUSampler>;
  private _uniformBuffers: Array<GPUBuffer>;
  private _vertexBuffersState: MaterialConstructor['vertexBuffersState'] = [];
  private _vertexBuffers: Array<GPUBuffer> = [];
  private _pipelineDescriptor: GPURenderPipelineDescriptor;
  private _indicesBuffer: GPUBuffer | null;
  private _settings: MaterialConstructor;

  constructor(settings: MaterialConstructor) {
    this._settings = settings;

    this._compiledShader = settings.shaderModule;
    this._textures = settings.textures;
    this._uniformBuffers = settings.uniformBuffers;
    this._samplers = settings.samplers;
    this._vertexBuffersState = settings.vertexBuffersState;
    this._vertexBuffers = settings.vertexBuffers;
    this._indicesBuffer = settings.indicesBuffer;

    this._pipelineDescriptor = {
      label: this._settings.id,
      vertex: {
        module: this._compiledShader,
        entryPoint: "vertex_main",
        buffers: this._vertexBuffersState,
      },
      fragment: {
        module: this._compiledShader,
        entryPoint: "fragment_main",
        targets: this._settings.fragmentTargets || [
          {
            format: settings.fragmentFormat || navigator.gpu.getPreferredCanvasFormat(),
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
        frontFace: "ccw",
        cullMode: 'none'
      },
      multisample: {
        count: MULTISAMPLE_COUNT,
      },
      layout: "auto",
      depthStencil: {
        format: DEPTH_STENCIL_FORMAT,
        depthWriteEnabled: true,
        depthCompare: 'less',
      }
    };

    this._checkValidityOfVertexBufferState();
  }

  private _checkValidityOfVertexBufferState() {
    const vbsLabels = this._vertexBuffersState.map(vbs => vbs.label)
    const vbLables = this.vertexBuffers.map(vb => vb.label)

    // if (!_.isEqual(vbsLabels, vbLables)) console.warn(`${this._settings.id}: Vertex Buffer State Error: s:${vbsLabels} != B:${vbLables}`)
  }

  enableDepthWrite(b: boolean) {
    this._pipelineDescriptor.depthStencil!.depthWriteEnabled = b;
  }

  setDepthCompare(v: GPUCompareFunction) {
    this._pipelineDescriptor.depthStencil!.depthCompare = v;
  }

  setPrimitiveState(s: GPUPrimitiveState) {
    this._pipelineDescriptor.primitive = s;
  }

  getBindGroupsDescriptors(renderPipeline: GPURenderPipeline): Array<BindGroupType> {
    let n = 0;
    const bindGroupDescriptorUniforms: BindGroupType | 0 = this._uniformBuffers.length && {
      index: n,
      description: {
        label: "uniforms",
        layout: renderPipeline.getBindGroupLayout(n++),
        entries: this._uniformBuffers.map((b, i): GPUBindGroupEntry => {
          return {
            binding: i, resource: { buffer: b },
          }
        })
      }
    }
    const bindGroupDescriptorTextures: BindGroupType | 0 = this._textures.length && {
      index: n,
      description: {
        label: "textures",
        layout: renderPipeline.getBindGroupLayout(n++),
        entries: this.textures.map((t, i): GPUBindGroupEntry => {
          return {
            binding: i, resource: t.createView(),
          }
        })
      }
    }
    const bindGroupDescriptorSampler: BindGroupType | 0 = this._samplers.length && {
      index: n,
      description: {
        label: "samplers",
        layout: renderPipeline.getBindGroupLayout(n++),
        entries: this.samplers.map((s, i): GPUBindGroupEntry => {
          return {
            binding: i, resource: s,
          }
        })
      }
    }

    return [bindGroupDescriptorUniforms, bindGroupDescriptorTextures, bindGroupDescriptorSampler].filter(e => e != 0)
  }

  get vertexBuffersState() {
    return this._vertexBuffersState;
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

  get samplers() {
    return this._samplers;
  }

  get vertexBuffers() {
    return this._vertexBuffers;
  }

  get indicesBuffer() {
    return this._indicesBuffer;
  }

  get pipelineDescriptor() {
    return this._pipelineDescriptor;
  }

  swapUnifromBuffers(ubs: GPUBuffer[]) {
    const currentBuffersLabels = this._uniformBuffers.map(s => s.label);
    const newSBuffersLabels = ubs.map(s => s.label);

    // if (!_.isEqual(currentBuffersLabels, newSBuffersLabels)) console.warn(`${this._settings.id}: Swap Unifroms Error: ${currentBuffersLabels} != ${newSBuffersLabels}`)

    this._uniformBuffers = ubs;
  }

  swapVertexBuffers(vbs: GPUBuffer[]) {
    const currentVBLabels = this._vertexBuffers.map(vb => vb.label);
    const newVBLabels = vbs.map(vb => vb.label);

    // if (!_.isEqual(currentVBLabels, newVBLabels)) console.warn(`${this._settings.id}: Swap Vertex Buffers Error: ${currentVBLabels} != ${newVBLabels}`);

    this._vertexBuffers = vbs;

    this._checkValidityOfVertexBufferState();
  }

  swapTextures(textures: GPUTexture[]) {
    const currentTexturesLabels = this._textures.map(t => t.label);
    const newTexturesLabels = textures.map(t => t.label);

    // if (!_.isEqual(currentTexturesLabels, newTexturesLabels)) console.warn(`${this._settings.id}: Swap Textures Error: ${currentTexturesLabels} != ${newTexturesLabels}`)

    this._textures = textures;
  }

  swapIndicesBuffer(ib: GPUBuffer) {
    this._indicesBuffer = ib;
  }

  swapSamplers(samplers: Array<GPUSampler>) {
    const currentSamplersLabels = this._samplers.map(s => s.label);
    const newSamplersLabels = samplers.map(s => s.label);

    // if (!_.isEqual(currentSamplersLabels, newSamplersLabels)) console.warn(`${this._settings.id}: Swap Samplers Error: ${currentSamplersLabels} != ${newSamplersLabels}`)

    this._samplers = samplers;
  }

  static _device: GPUDevice | null = null;
  static _zeroedTextures: { [key in keyof typeof TEXTURE_IDS]: GPUTexture } | null;
  static _zeroedBuffers: { [key in keyof typeof VERTEX_BUFFER_IDS]: GPUBuffer } | null;
  static _zeroedSamplers: { [key in keyof typeof TEXTURE_SAMPLERS_IDS]: GPUSampler } | null;



  static setContext(device: GPUDevice) {
    this._device = device;
    const texSettings = (label: string): GPUTextureDescriptor => ({
      format: 'rgba8unorm',
      size: [1, 1, 1],
      usage: GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST,
      dimension: '2d',
      label
    });
    this._zeroedTextures = {
      colorTexture: this._device.createTexture(texSettings(TEXTURE_IDS.colorTexture)),
      emissiveTexture: this._device.createTexture(texSettings(TEXTURE_IDS.emissiveTexture)),
      metalicRoughnessTexture: this._device.createTexture(texSettings(TEXTURE_IDS.metalicRoughnessTexture)),
      normalTexture: this._device.createTexture(texSettings(TEXTURE_IDS.normalTexture)),
    }
    this._device.queue.writeTexture({ texture: this._zeroedTextures.colorTexture }, new Uint8Array([255, 0, 0, 0]), {}, { width: 1, height: 1 })
    this._device.queue.writeTexture({ texture: this._zeroedTextures.emissiveTexture }, new Uint8Array([0, 0, 0, 0]), {}, { width: 1, height: 1 })
    this._device.queue.writeTexture({ texture: this._zeroedTextures.metalicRoughnessTexture }, new Uint8Array([0, 0, 0, 0]), {}, { width: 1, height: 1 })
    this._device.queue.writeTexture({ texture: this._zeroedTextures.normalTexture }, new Uint8Array([0, 0, 0, 0]), {}, { width: 1, height: 1 })


    const bufSettings = (label: string, size: number): GPUBufferDescriptor => ({
      size,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      label,
    })

    this._zeroedBuffers = {
      normalsBuffer: this._device.createBuffer(bufSettings(VERTEX_BUFFER_IDS.normalsBuffer, VERTEX_BUFFER_SIZES.normalsBuffer)),
      texCoordsBuffer: this._device.createBuffer(bufSettings(VERTEX_BUFFER_IDS.texCoordsBuffer, VERTEX_BUFFER_SIZES.texCoordsBuffer)),
      tangetsBuffer: this._device.createBuffer(bufSettings(VERTEX_BUFFER_IDS.tangetsBuffer, VERTEX_BUFFER_SIZES.tangetsBuffer)),
      positionBuffer: this._device.createBuffer(bufSettings(VERTEX_BUFFER_IDS.positionBuffer, VERTEX_BUFFER_SIZES.positionBuffer))
    }

    this._device.queue.writeBuffer(this._zeroedBuffers.normalsBuffer, 0, new Float32Array([0, 0, 0]))
    this._device.queue.writeBuffer(this._zeroedBuffers.positionBuffer, 0, new Float32Array([0, 0, 0]))
    this._device.queue.writeBuffer(this._zeroedBuffers.tangetsBuffer, 0, new Float32Array([0, 0, 0, 0]))
    this._device.queue.writeBuffer(this._zeroedBuffers.texCoordsBuffer, 0, new Float32Array([0, 0]))

    this._zeroedSamplers = {
      colorSampler: this._device.createSampler({ label: TEXTURE_SAMPLERS_IDS.colorSampler }),
      emissiveSampler: this._device.createSampler({ label: TEXTURE_SAMPLERS_IDS.emissiveSampler }),
      metalicRoughnessSampler: this._device.createSampler({ label: TEXTURE_SAMPLERS_IDS.metalicRoughnessSampler }),
      normalSampler: this._device.createSampler({ label: TEXTURE_SAMPLERS_IDS.normalSampler })
    }
  }

  static create(settings: MaterialConstructor): Material {


    const vb: GPUBuffer[] = [this._zeroedBuffers?.positionBuffer!, this._zeroedBuffers?.texCoordsBuffer!, this._zeroedBuffers?.normalsBuffer!, this._zeroedBuffers?.tangetsBuffer!]
    const vbsLabels = vb.map(v => v.label);
    const originalUniqueVB = settings.vertexBuffers.filter(v => !vbsLabels.includes(v.label))
    const vertexBuffers = vb.map(b => settings.vertexBuffers.find(o => b.label === o.label) || b)
    vertexBuffers.push(...originalUniqueVB)

    const tex: GPUTexture[] = [this._zeroedTextures?.colorTexture!, this._zeroedTextures?.normalTexture!, this._zeroedTextures?.emissiveTexture!, this._zeroedTextures?.metalicRoughnessTexture!]
    const texLabels = tex.map(t => t.label);
    const originalUniqueTex = settings.textures.filter(t => !texLabels.includes(t.label))
    const textures = tex.map(t => settings.textures.find(o => t.label === o.label) || t)
    textures.push(...originalUniqueTex)

    const sam: GPUSampler[] = [this._zeroedSamplers?.colorSampler!, this._zeroedSamplers?.normalSampler!, this._zeroedSamplers?.emissiveSampler!, this._zeroedSamplers?.metalicRoughnessSampler!]
    const samLabels = sam.map(s => s.label);
    const originalUniqueSam = settings.samplers.filter(s => !samLabels.includes(s.label))
    const samplers = sam.map(s => settings.samplers.find(o => s.label === o.label) || s)
    samplers.push(...originalUniqueSam)

    const existingVBSLabels = [VERTEX_BUFFER_IDS.positionBuffer, VERTEX_BUFFER_IDS.texCoordsBuffer, VERTEX_BUFFER_IDS.normalsBuffer, VERTEX_BUFFER_IDS.tangetsBuffer]
    const vbs = new VBSG()
      .add(VERTEX_BUFFER_IDS.positionBuffer, { format: VERTEX_BUFFER_SIZES_FORMAT.positionBuffer }, false)
      .add(VERTEX_BUFFER_IDS.texCoordsBuffer, { format: VERTEX_BUFFER_SIZES_FORMAT.texCoordsBuffer }, false)
      .add(VERTEX_BUFFER_IDS.normalsBuffer, { format: VERTEX_BUFFER_SIZES_FORMAT.normalsBuffer }, false)
      .add(VERTEX_BUFFER_IDS.tangetsBuffer, { format: VERTEX_BUFFER_SIZES_FORMAT.tangetsBuffer }, false)

    const originalVBS = settings.vertexBuffersState.filter(vbs => !existingVBSLabels.includes(vbs.label as any))
    originalVBS.forEach(ovbs => vbs.add(ovbs.label, { format: (ovbs.attributes as any[])[0].format }, false));

    const vertexBuffersState = vbs.end()


    const mSettings: MaterialConstructor = {
      ...settings,
      vertexBuffers,
      textures,
      samplers,
      vertexBuffersState
    }

    return new Material(mSettings)

  }
}