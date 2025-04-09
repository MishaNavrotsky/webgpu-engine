import { mat4 } from "gl-matrix";
import { DIRECTIONAL_LIGHT_DEPTH_TEXTURE_SIZE, LIGHT_TYPES } from "@/constants";
import ModelMatrix from "../../ModelMatrix";
import ProjectionMatrix from "@/lib/ProjectionMatrix";
import IRenderPass from "../interfaces/IRenderPass";
import Material from "../Material";
import RenderPipeline from "../RenderPipeline";
import { GlobalLoader } from "@/lib/loader";
import ViewMatrix from "@/lib/ViewMatrix";

export type DirectionalLightConstructor = {
  id: string,
  depthTexture: GPUTexture,
  renderPipeline: RenderPipeline,
  projectionViewUniform: GPUBuffer,
}

export type DirectionalLightCreate = {
  id: string,
  depthTexture?: GPUTexture,
  renderPipeline?: RenderPipeline,
  projectionViewUniform?: GPUBuffer,
  depthTextureSize?: [number, number]
}


export default class DirectionalLight implements IRenderPass {
  type = LIGHT_TYPES.directional;
  isCustomMaterial = true;
  private _cModelMatrix: ModelMatrix = new ModelMatrix();
  private _cProjectionMatrix: ProjectionMatrix = new ProjectionMatrix();
  private _cViewMatrix: ViewMatrix = new ViewMatrix();


  private _renderPassDescriptor: GPURenderPassDescriptor

  private _customMaterial: Material;

  private _s: DirectionalLightConstructor;

  private constructor(s: DirectionalLightConstructor) {
    this.id = s.id;
    this._s = s;

    this._renderPassDescriptor = {
      label: 'deferred',
      colorAttachments: [],
      depthStencilAttachment: {
        view: this._s.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    }

    this._customMaterial = new Material({
      id: this.id,
      renderPipeline: this._s.renderPipeline,
    })

    // depthStencil: {
    //   depthWriteEnabled: true,
    //     depthCompare: 'less',
    //       format: 'depth32float',
    // },

  }
  generateMaterial(cameraModelBuffer: GPUBuffer[]): Material {
    this._customMaterial.swapUniformBuffers([this._s.projectionViewUniform, cameraModelBuffer[0]])
    return this._customMaterial;
  }
  getRenderPassDescriptor(): GPURenderPassDescriptor {
    return this._renderPassDescriptor;
  }
  getOutputTextures(): GPUTexture {
    return this._s.depthTexture;
  }
  getProjectionViewMatrix(): mat4 {
    return mat4.mul(mat4.create(), this._cProjectionMatrix.projectionMatrix, this._cViewMatrix.viewMatrix);
  }
  getModelMatrix(): mat4 {
    return this._cModelMatrix.modelMatrix;
  }

  static create(s: DirectionalLightCreate, device: GPUDevice): DirectionalLight {
    const projectionViewUniform = s.projectionViewUniform || device.createBuffer({
      size: 4 * 4 * 4,
      label: s.id + '_projectionViewUniform',
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const depthTextureSize = s.depthTextureSize || DIRECTIONAL_LIGHT_DEPTH_TEXTURE_SIZE;

    const renderPipeline = s.renderPipeline || new RenderPipeline({
      id: s.id + '_renderPipeline',
      shaderModule: device.createShaderModule({
        label: s.id + '_shaderModule',
        code: GlobalLoader.getShader('zbuffer')!
      }),
      cullMode: 'back',
      fragmentPipelineDescriptorState: null,
    })

    const directionalLight = new DirectionalLight({
      ...s,
      depthTexture: s.depthTexture || device.createTexture({
        size: depthTextureSize,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        format: 'depth32float',
      }),
      projectionViewUniform,
      renderPipeline,
    })

    return directionalLight;
  }

  static populate(dl: DirectionalLight, device: GPUDevice) {
    device.queue.writeBuffer(dl._s.projectionViewUniform, 0, new Float32Array(dl.getProjectionViewMatrix()))
  }

  id: string;
}