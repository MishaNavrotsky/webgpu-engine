import { DEPTH_STENCIL_FORMAT, MULTISAMPLE_COUNT, TEXTURE_SAMPLERS_IDS, VERTEX_BUFFER_IDS, TEXTURE_IDS, VERTEX_BUFFER_SIZES, VERTEX_BUFFER_SIZES_FORMAT, VBS_DEF_SEQUENCE } from "@/constants";
import _ from 'lodash';
import VBSG from "./VertexBuffersStateGenerator";

export type RenderPipelineConstructor = {
  id: string,
  shaderModule: GPUShaderModule,
  vertexBuffersState?: (GPUVertexBufferLayout & { label: string })[],
  fragmentTargets?: Array<GPUColorTargetState>,
  primitiveState?: GPUPrimitiveState,
  depthStencilState?: GPUDepthStencilState | null,
  cullMode?: GPUCullMode,
  fragmentPipelineDescriptorState?: GPUFragmentState | null,
}

export type BindGroupType = {
  index: number, description: GPUBindGroupDescriptor
}

const vbsgC = new VBSG();
VBS_DEF_SEQUENCE.forEach(id => {
  vbsgC.add(id, { format: VERTEX_BUFFER_SIZES_FORMAT[id] }, false)
})
const defaultVBS = vbsgC.end();


export default class RenderPipeline {
  private _compiledShader: GPUShaderModule;
  private _vertexBuffersState: NonNullable<RenderPipelineConstructor['vertexBuffersState']>;
  private _renderPipelineDescriptor: GPURenderPipelineDescriptor;
  private _settings: RenderPipelineConstructor;
  private _id: string;

  get id() {
    return this._id;
  }

  constructor(settings: RenderPipelineConstructor) {
    this._settings = settings;

    this._id = settings.id;

    this._compiledShader = settings.shaderModule;
    this._vertexBuffersState = settings.vertexBuffersState ?? defaultVBS;

    let fragment: GPUFragmentState | undefined = this._settings.fragmentPipelineDescriptorState || {
      module: this._compiledShader,
      entryPoint: "fragment_main",
      targets: this._settings.fragmentTargets ?? [
        {
          format: navigator.gpu.getPreferredCanvasFormat(),
        },
      ],
    }
    if (this._settings.fragmentPipelineDescriptorState === null) fragment = undefined;

    let depthStencil: GPUDepthStencilState | undefined = this._settings.depthStencilState || {
      format: DEPTH_STENCIL_FORMAT,
      depthWriteEnabled: true,
      depthCompare: 'less',
    }
    if (this._settings.depthStencilState === null) depthStencil = undefined;

    this._renderPipelineDescriptor = {
      label: this._settings.id,
      vertex: {
        module: this._compiledShader,
        entryPoint: "vertex_main",
        buffers: this._vertexBuffersState,
      },
      fragment: fragment,
      primitive: settings.primitiveState ?? {
        topology: "triangle-list",
        frontFace: "ccw",
        cullMode: this._settings.cullMode ?? 'none'
      },
      multisample: {
        count: MULTISAMPLE_COUNT,
      },
      layout: "auto",
      depthStencil,
    };
  }

  setDepthWriteEnabled(v: boolean) {
    this._renderPipelineDescriptor.depthStencil!.depthWriteEnabled = v;
  }

  get vertexBuffersState() {
    return this._vertexBuffersState;
  }

  get shaderModule() {
    return this._compiledShader;
  }

  get descriptor() {
    return this._renderPipelineDescriptor
  }
}