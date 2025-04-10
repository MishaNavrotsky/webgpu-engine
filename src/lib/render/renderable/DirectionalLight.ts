import { glMatrix, mat4, vec3, vec4 } from "gl-matrix";
import { DIRECTIONAL_LIGHT_DEPTH_TEXTURE_SIZE, LIGHT_TYPES } from "@/constants";
import ModelMatrix from "../../ModelMatrix";
import ProjectionMatrix from "@/lib/ProjectionMatrix";
import IRenderPass from "../interfaces/IRenderPass";
import Material from "../Material";
import RenderPipeline from "../RenderPipeline";
import { GlobalLoader } from "@/lib/loader";
import ViewMatrix from "@/lib/ViewMatrix";
import IModelPosition from "../interfaces/IModelPosition";
import Camera from "@/lib/camera";
import _ from "lodash";

export type DirectionalLightConstructor = {
  id: string,
  depthTexture: GPUTexture,
  renderPipeline: RenderPipeline,
  projectionViewUniform: GPUBuffer,
  depthSampler: GPUSampler,
  direction: vec3,
  position: vec3,
}

export type DirectionalLightCreate = {
  id: string,
  direction: vec3,
  position: vec3,
  depthTexture?: GPUTexture,
  depthSampler?: GPUSampler,
  renderPipeline?: RenderPipeline,
  projectionViewUniform?: GPUBuffer,
  depthTextureSize?: [number, number]
}


export default class DirectionalLight implements IRenderPass, IModelPosition {
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
      label: `${this._s.id}_renderPass`,
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
  }

  calculate(camera: Camera, nearPlane: number, farPlane: number) {
    const proj = mat4.perspectiveZO(mat4.create(), glMatrix.toRadian(camera.fov), camera.width / camera.height, nearPlane, farPlane);
    const inverse = mat4.invert(mat4.create(), mat4.mul(mat4.create(), proj, camera.viewMatrix))

    const frustrumCorners: vec4[] = [];
    for (let x = 0; x < 2; ++x) {
      for (let y = 0; y < 2; ++y) {
        for (let z = 0; z < 2; ++z) {
          const v = vec4.fromValues(2.0 * x - 1.0, 2.0 * y - 1.0, 2.0 * z - 1.0, 1.0);
          const pt = vec4.transformMat4(vec4.create(), v, inverse);

          frustrumCorners.push(vec4.fromValues(pt[0] / pt[3], pt[1] / pt[3], pt[2] / pt[3], pt[3] / pt[3]));
        }
      }
    }

    var center = vec3.create();
    for (let corner of frustrumCorners) {
      vec3.add(center, center, [corner[0], corner[1], corner[2]])
    }
    vec3.div(center, center, [frustrumCorners.length, frustrumCorners.length, frustrumCorners.length])

    const lightView = mat4.lookAt(mat4.create(),
      vec3.add(vec3.create(), center, this._s.direction),
      center,
      [0.0, 1.0, 0.0]
    );

    const min = Number.MIN_SAFE_INTEGER;
    const max = Number.MAX_SAFE_INTEGER;

    var minX = max;
    var maxX = min;
    var minY = max;
    var maxY = min;
    var minZ = max;
    var maxZ = min;

    for (const v of frustrumCorners) {
      const trf = vec4.transformMat4(vec4.create(), v, lightView)
      minX = Math.min(minX, trf[0]);
      maxX = Math.max(maxX, trf[0]);
      minY = Math.min(minY, trf[1]);
      maxY = Math.max(maxY, trf[1]);
      minZ = Math.min(minZ, trf[2]);
      maxZ = Math.max(maxZ, trf[2]);
    }

    var zMult = 10.0;
    if (minZ < 0) {
      minZ *= zMult;
    }
    else {
      minZ /= zMult;
    }
    if (maxZ < 0) {
      maxZ /= zMult;
    }
    else {
      maxZ *= zMult;
    }

    const lightProjection = mat4.orthoZO(mat4.create(), minX, maxX, minY, maxY, minZ, maxZ);

    return mat4.mul(mat4.create(), lightProjection, lightView);
  }

  scale(v: vec3): void {
    this._cModelMatrix.scale = v;
  }
  translate(v: vec3): void {
    this._cModelMatrix.translation = v;
  }
  rotateDeg(v: vec3): void {
    this._cModelMatrix.rotation = v;
    this._s.direction = v;
  }
  getScale(): vec3 {
    return this._cModelMatrix.scale;
  }
  getRotationDeg(): vec3 {
    return this._cModelMatrix.rotation;
  }
  getPosition(): vec3 {
    return this._cModelMatrix.translation;
  }
  generateMaterial(): Material {
    return this._customMaterial;
  }
  getRenderPassDescriptor(): GPURenderPassDescriptor {
    return this._renderPassDescriptor;
  }
  getOutputTextures(): GPUTexture {
    return this._s.depthTexture;
  }
  getProjectionViewMatrix(): mat4 {
    return mat4.mul(mat4.create(), this._cProjectionMatrix.projectionMatrixOrtho, this._cViewMatrix.viewMatrix);
  }
  getModelMatrix(): mat4 {
    return this._cModelMatrix.modelMatrix;
  }
  getRenderPipeline(): RenderPipeline {
    return this._s.renderPipeline;
  }

  getUniformProjectionViewMatrix(): GPUBuffer {
    return this._s.projectionViewUniform;
  }
  getTextureSampler(): GPUSampler {
    return this._s.depthSampler;
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
      cullMode: 'none',
      fragmentPipelineDescriptorState: null,
      depthStencilState: {
        format: 'depth32float',
        depthCompare: 'less',
        depthWriteEnabled: true,
      },
    })

    const directionalLight = new DirectionalLight({
      ...s,
      depthTexture: s.depthTexture || device.createTexture({
        size: depthTextureSize,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        format: 'depth32float',
      }),
      depthSampler: s.depthSampler || device.createSampler({
        compare: 'less',
      }),
      projectionViewUniform,
      renderPipeline,
    })

    return directionalLight;
  }

  static populate(dl: DirectionalLight, device: GPUDevice, camera: Camera) {
    device.queue.writeBuffer(dl._s.projectionViewUniform, 0, new Float32Array(dl.calculate(camera, 0.1, 100)))
  }

  id: string;
}