import { mat4, vec4 } from "gl-matrix";
import Camera from "@/lib/camera";
import Loader from "@/lib/loader";
import Material, { MaterialConstructor } from "./Material";
import MeshData from "./MeshData";
import UI from "@/lib/ui";
import VBSG from "./VertexBuffersStateGenerator";
import { INDICES_BUFFER_ID, UNIFORM_BUFFER_IDS, VERTEX_BUFFER_IDS, TEXTURE_IDS, TEXTURE_SAMPLERS_IDS, D_PASS_TEXTURE_FORMAT, D_PASS_FRAGMENT_OUTS } from "@/constants";
import RenderableObject from "./renderable/RenderableObject";
import BuffersData from "./BuffersData";
import RenderPipeline from "./RenderPipeline";
import IRenderableObject from "./interfaces/IRenderableObject";
import GLBMesh from "../loader/GLBMesh";
import Scene from "../scene";

export const DRENDER_MODES = {
  diffuse: 0,
  albedo: 1,
  emissive: 2,
  metalicRoughness: 3,
  pNormals: 4,
  worldPosition: 5,
  vBiTangents: 6,
  vNormals: 7,
  vTangents: 8,
}

type PointLight = {
  position: vec4,
  color: vec4,
  intensityRadiusZZ: vec4,
}

export type RData = Array<{ renderableObject: IRenderableObject, renderPipeline?: GPURenderPipeline, type?: 'forward' | 'deferred' }>

type RendererConstructor = {
  camera: Camera, loader: Loader, canvas: HTMLCanvasElement
}
export default class Renderer {
  private _meshes: RData = [];
  private _camera: Camera;
  private _loader: Loader;
  private _canvas: HTMLCanvasElement
  private _fov: number = 90;
  private _lastCpuTime = 0;
  private _lastGpuTime = 0;
  private _ui: UI | undefined;
  private _callbackToDoBeforeRender: CallableFunction = () => { };

  private _device!: GPUDevice;
  private _context!: GPUCanvasContext;

  private _depthTexture!: GPUTexture;
  private _depthTextureView!: GPUTextureView;
  private _deferredDepthTexture?: GPUTexture;
  private _deferredDepthTextureView?: GPUTextureView;

  private _dPassResult?: GPUTexture[];
  private _dPassMaterial?: Material;
  private _dPassRenderPipeline?: GPURenderPipeline;

  constructor(settings: RendererConstructor) {
    this._canvas = settings.canvas;
    this._loader = settings.loader;
    this._camera = settings.camera;
    this._camera.init(settings.canvas.width, settings.canvas.height, this._fov);

    const resizeObserver = new ResizeObserver(() => {
      settings.canvas.width = window.innerWidth;
      settings.canvas.height = window.innerHeight;

      this._camera.setPerspective(settings.canvas.width, settings.canvas.height, settings.camera.fov)

      this._callbackToDoBeforeRender = () => {
        this.createDepthTexture();
        this.createDeferredDepthTexture();
        this.prepareTexturesForGBuffers();

        this._callbackToDoBeforeRender = () => { }
      }
    });
    resizeObserver.observe(settings.canvas);
  }
  getDevice() {
    return this._device;
  }

  getTimings() {
    return { cpu: this._lastCpuTime, gpu: this._lastGpuTime }
  }

  setUI(ui: UI) {
    this._ui = ui;
  }

  async initWebGpuCanvasContext() {
    if (!navigator.gpu) {
      throw Error("WebGPU not supported.");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw Error("Couldn't request WebGPU adapter.");
    }

    this._device = await adapter.requestDevice({
      requiredLimits: {
        maxColorAttachmentBytesPerSample: 128,
      },
      requiredFeatures: ['timestamp-query']
    });
    this._context = this._canvas.getContext('webgpu')!;
    this._context.configure({
      device: this._device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      alphaMode: "premultiplied",
    });
    this.createDepthTexture();
    this.createDeferredDepthTexture();

    Material.setContext(this._device);
  }
  private _deferredRendererQuad!: RenderableObject;

  private async prepareMeshForGBuffers() {
    const id = 'full-screen'
    const quadMeshData = new MeshData({
      id,
      indices: new Uint32Array([0, 1, 2, 2, 3, 0]),
      vertecies: new Float32Array([
        -1, -1, 0,
        -1, 1, 0,
        1, 1, 0,
        1, -1, 0
      ]),
      texCoords: new Float32Array([0, 0, 0]),
    });

    const quadBuffersData = new BuffersData({
      id,
      indicesBuffer: this._device.createBuffer({
        size: quadMeshData.indices.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.INDEX,
        label: 'full-screen-indices-buffer'
      }),
      positionBuffer: this._device.createBuffer({
        size: quadMeshData.vertecies.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
      }),
      texCoordsBuffer: this._device.createBuffer({
        size: quadMeshData.vertecies.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
      }),
    })

    const quadRenderPipeline = new RenderPipeline({
      id,
      shaderModule: this._device.createShaderModule({
        label: 'deferred/main',
        code: this._loader.getShader('deferred/main')!
      }),
      vertexBuffersState: new VBSG()
        .add(VERTEX_BUFFER_IDS.positionBuffer, { format: 'float32x3' }, false)
        .add(VERTEX_BUFFER_IDS.texCoordsBuffer, { format: 'float32x2' }, false)
        .end(),
    })
    quadRenderPipeline.setDepthWriteEnabled(false);

    const quadMaterial = new Material({
      id,
      textures: this._dPassResult!,
      uniformBuffers: [
        this._device.createBuffer({
          size: 4 * 4 * 4 * 4 + 4 * 4,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          label: UNIFORM_BUFFER_IDS.camera,
        }), //MVP + NM + POS,
        this._device.createBuffer({
          size: 4 * 4 + 4 * 4 + 4 * 4, //vec4 + vec4 + vec4
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
          label: UNIFORM_BUFFER_IDS.pointLights
        }), //point lights
        this._device.createBuffer({
          size: 4, //vec4 + vec4 + vec4
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          label: UNIFORM_BUFFER_IDS.settings
        }) //settings,
      ],
      renderPipeline: quadRenderPipeline,
    })

    this._device.queue.writeBuffer(quadBuffersData.positionBuffer, 0, quadMeshData.vertecies);
    this._device.queue.writeBuffer(quadBuffersData.texCoordsBuffer!, 0, quadMeshData.texCoords!);
    this._device.queue.writeBuffer(quadBuffersData.indicesBuffer, 0, quadMeshData.indices);

    this._deferredRendererQuad = new RenderableObject({
      buffersData: quadBuffersData,
      id,
      material: quadMaterial,
      meshData: quadMeshData,
      castShadow: false,
      receiveShadows: false,
    });

    this._meshes.push({
      renderableObject: this._deferredRendererQuad, renderPipeline: this._device.createRenderPipeline(quadRenderPipeline.descriptor), type: 'forward'
    })
  }

  async render(dT: number) {
    this._callbackToDoBeforeRender();
    const cpuTimeStart = performance.now()
    {
      this._camera.calculate(dT, true);
      await this.renderGBuffers();
      await this.forwardRender();
    }
    this._lastCpuTime = performance.now() - cpuTimeStart;

    const gpuTimeStart = performance.now();
    await this._device.queue.onSubmittedWorkDone()
    this._lastGpuTime = performance.now() - gpuTimeStart;
  }

  private createDepthTexture() {
    this._deferredDepthTexture && this._depthTexture.destroy();
    this._depthTexture = this._device?.createTexture({
      format: 'depth24plus',
      size: [this._canvas.width, this._canvas.height],
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      dimension: '2d',
    });
    this._depthTextureView = this._depthTexture?.createView();
  }

  private createDeferredDepthTexture() {
    this._deferredDepthTexture = this._device?.createTexture({
      format: 'depth24plus',
      size: [this._canvas.width, this._canvas.height],
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      dimension: '2d',
    });
    this._deferredDepthTextureView = this._deferredDepthTexture!.createView();
  }

  private prepareTexturesForGBuffers() {
    this._dPassResult?.forEach(t => t.destroy());
    this._dPassResult = D_PASS_FRAGMENT_OUTS.map(label => this._device.createTexture({
      label,
      format: D_PASS_TEXTURE_FORMAT,
      size: [this._canvas.width, this._canvas.height, 1],
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    }))

    this._deferredRendererQuad && this._deferredRendererQuad.getMaterial().swapTextures(this._dPassResult);
  }

  async initDeferredRender() {
    const id = 'gbufferPass'
    const renderPipeline = new RenderPipeline({
      id,
      shaderModule: this._device.createShaderModule({
        label: 'deferred/prepareBuffers',
        code: this._loader.getShader('deferred/prepareBuffers')!
      }),
      fragmentTargets: D_PASS_FRAGMENT_OUTS.map(() => ({ format: D_PASS_TEXTURE_FORMAT })),
    })
    this._dPassMaterial = Material.create({
      id,
      renderPipeline,
    }, this._device)

    this._dPassRenderPipeline = this._device.createRenderPipeline(renderPipeline.descriptor);
    this.prepareTexturesForGBuffers();
    this.prepareMeshForGBuffers();
  }

  private async renderGBuffers() {
    if (!this._dPassMaterial) return;
    const encoder = this._device.createCommandEncoder({ label: 'deferred' });
    const passEncoder = encoder.beginRenderPass({
      label: 'deferred',
      colorAttachments: D_PASS_FRAGMENT_OUTS.map((_, i) => ({
        loadOp: 'clear',
        storeOp: 'store',
        view: this._dPassResult![i].createView()
      })),
      depthStencilAttachment: {
        view: this._deferredDepthTextureView!,
        depthStoreOp: 'store',
        depthLoadOp: 'clear',
        depthClearValue: 1.0,
      }
    })

    for (const m of this._meshes) {
      if (m.type === 'forward') continue;
      const r = m.renderableObject;
      const rMaterial = r.getMaterial();
      const dMaterial = this._dPassMaterial;

      r.swapMaterial(dMaterial)

      dMaterial.swapTextures(rMaterial.textures!);
      dMaterial.swapColorTexture(rMaterial.colorTexture!);
      dMaterial.swapEmissiveTexture(rMaterial.emissiveTexture!);
      dMaterial.swapMetalicRoughnessTexture(rMaterial.metalicRoughnessTexture!);
      dMaterial.swapNormalTexture(rMaterial.normalTexture!);

      dMaterial.swapSamplers(rMaterial.samplers!);
      dMaterial.swapColorSampler(rMaterial.colorSampler!);
      dMaterial.swapEmissiveSampler(rMaterial.emissiveSampler!);
      dMaterial.swapMetalicRoughnessSampler(rMaterial.metalicRoughnessSampler!);
      dMaterial.swapNormalSampler(rMaterial.normalSampler!);

      const modelMatrix = r.getModelMatrix();
      const viewMatrix = this._camera.viewMatrix;
      const projectionMatrix = this._camera.projectionMatrix;
      const normalMatrix = mat4.create();
      mat4.invert(normalMatrix, modelMatrix);
      mat4.transpose(normalMatrix, normalMatrix)

      const cameraUB = rMaterial.uniformBuffers![0]
      this._device.queue.writeBuffer(cameraUB, 0, new Float32Array([...projectionMatrix, ...viewMatrix, ...modelMatrix, ...normalMatrix, ...this._camera.position, 0]));
      dMaterial.swapUniformBuffers([cameraUB]);

      this.renderRenderable(m.renderableObject, this._dPassRenderPipeline!, passEncoder);

      r.swapMaterial(rMaterial);
    }
    passEncoder.end();
    return this._device.queue.submit([encoder.finish()]);
  }

  private async forwardRender() {
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          clearValue: { r: 0.5294, g: 0.8039, b: 0.9725, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
          view: this._context.getCurrentTexture().createView(),
        },
      ],
      depthStencilAttachment: {
        view: this._depthTextureView,
        depthStoreOp: 'store',
        depthLoadOp: 'clear',
        depthClearValue: 1.0,
      }
    };

    const encoder = this._device.createCommandEncoder({ label: 'forward' });
    const passEncoder = encoder.beginRenderPass(renderPassDescriptor)


    for (const m of this._meshes) {
      if (m.type !== 'forward') continue;
      const r = m.renderableObject;
      const material = r.getMaterial();

      const modelMatrix = r.getModelMatrix();
      const viewMatrix = this._camera.viewMatrix;
      const projectionMatrix = this._camera.projectionMatrix;
      const normalMatrix = mat4.create();
      mat4.invert(normalMatrix, modelMatrix);
      mat4.transpose(normalMatrix, normalMatrix)

      const pointLight: PointLight = this._ui?.lightsInfo!;
      const deferredSettings = this._ui?.deferredSettings!;

      material.uniformBuffers![0] && this._device.queue.writeBuffer(material.uniformBuffers![0], 0, new Float32Array([...projectionMatrix, ...viewMatrix, ...modelMatrix, ...normalMatrix, ...this._camera.position, 0]));
      material.uniformBuffers![1] && this._device.queue.writeBuffer(material.uniformBuffers![1], 0, new Float32Array([...pointLight.position, ...pointLight.color, ...pointLight.intensityRadiusZZ]));
      material.uniformBuffers![2] && this._device.queue.writeBuffer(material.uniformBuffers![2], 0, new Uint32Array([deferredSettings]));

      const renderPipeline = m.renderPipeline;

      this.renderRenderable(r, renderPipeline!, passEncoder);
    }

    passEncoder.end();

    this._device.queue.submit([encoder.finish()]);
  }

  private renderRenderable(r: IRenderableObject, renderPipeline: GPURenderPipeline, passEncoder: GPURenderPassEncoder) {
    const material = r.getMaterial();
    const buffersData = r.getBuffersData()
    const meshData = r.getMeshData()
    const bindGroupsDescriptors = r.getBindGroupsDescriptors(renderPipeline);
    const bindGroups = bindGroupsDescriptors.map(desc => {
      return this._device.createBindGroup(desc.description)
    })

    passEncoder.setPipeline(renderPipeline);
    bindGroupsDescriptors.forEach(desc => {
      passEncoder.setBindGroup(desc.index, bindGroups[desc.index])
    })
    buffersData.allBuffers.forEach((b, i) => {
      passEncoder.setVertexBuffer(i, b);
    })
    passEncoder.setIndexBuffer(buffersData.indicesBuffer, "uint32");
    passEncoder.drawIndexed(meshData.indices.length)
  }

  async initForwardRender() {

  }

  async prepareMeshes(scene: Scene['_sceneRenderables']) {
    scene.forEach(el => {
      const renderPipeline = this._device.createRenderPipeline(el.getMaterial().renderPipeline.descriptor);
      const r = { renderableObject: el as IRenderableObject, renderPipeline }

      this._meshes.push(r);
    })
  }
}