import { DEPTH_STENCIL_FORMAT, MULTISAMPLE_COUNT } from "@/CONSTANTS";

export type MaterialConstructor = {
  id: string,
  shaderModule: GPUShaderModule,
  textures: Array<GPUTexture>,
  uniformBuffers: Array<GPUBuffer>,
  samplers: Array<GPUSampler>,
  vertexBuffersState: GPUVertexState['buffers'],
}

export type BindGroupType = {
  index: number, description: GPUBindGroupDescriptor
}

export default class Material {
  private _compiledShader: GPUShaderModule;
  private _textures: Array<GPUTexture>;
  private _samplers: Array<GPUSampler>;
  private _uniformBuffers: Array<GPUBuffer>;
  private _vertexBuffersState: GPUVertexState['buffers'] = []
  private _pipelineDescriptor: GPURenderPipelineDescriptor;

  constructor(settings: MaterialConstructor) {
    this._compiledShader = settings.shaderModule;
    this._textures = settings.textures;
    this._uniformBuffers = settings.uniformBuffers;
    this._samplers = settings.samplers;
    this._vertexBuffersState = settings.vertexBuffersState;

    this._pipelineDescriptor = {
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
            format: navigator.gpu.getPreferredCanvasFormat(),
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
        frontFace: "ccw",
        // cullMode: 'back'
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


  }

  enableDepthWrite(b: boolean) {
    this._pipelineDescriptor.depthStencil!.depthWriteEnabled = b;
  }

  setPrimitiveState(s: GPUPrimitiveState) {
    this._pipelineDescriptor.primitive = s;
  }

  getBindGroups(renderPipeline: GPURenderPipeline): Array<BindGroupType> {
    let n = 0;
    const bindGroupDescriptorUniforms: BindGroupType | 0 = this._uniformBuffers.length && {
      index: n,
      description: {
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
        layout: renderPipeline.getBindGroupLayout(n++),
        entries: this.textures.map((t, i): GPUBindGroupEntry => {
          return {
            binding: i, resource: t.createView(),
          }
        })
      }
    }
    const bindGroupDescriptorSampler: BindGroupType | 0 = this._samplers.length && {
      index: n, description: {
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
}