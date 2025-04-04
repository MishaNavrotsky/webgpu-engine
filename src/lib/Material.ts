import { DEPTH_STENCIL_FORMAT, MULTISAMPLE_COUNT } from "@/constants";
import _ from 'lodash';

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
        targets: [
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
}