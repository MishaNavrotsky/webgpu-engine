import { vec4 } from "gl-matrix";
import Camera from "./Camera";
import Loader from "./Loader";
import Material, { MaterialConstructor } from "./Material";
import Mesh from "./Mesh";
import UI from "@/ui";
import VBSG from "./VertexBuffersStateGenerator";
import { INDICES_BUFFER_ID, UNIFORM_BUFFER_IDS, VERTEX_BUFFER_IDS, TEXTURE_IDS, TEXTURE_SAMPLERS_IDS, D_PASS_TEXTURE_FORMAT, D_PASS_FRAGMENT_OUTS } from "@/constants";

type PointLight = {
  position: vec4,
  color: vec4,
  intensityRadiusZZ: vec4,
}

type MeshData = Array<{ mesh: Mesh, material: Material, renderPipeline: GPURenderPipeline, type?: 'forward' | 'deferred' }>

type RendererConstructor = {
  camera: Camera, loader: Loader, canvas: HTMLCanvasElement
}
export default class Renderer {
  private _meshes: MeshData = [];
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
  private _deferredRendererMesh!: { mesh: Mesh, material: Material }

  private async prepareMeshForGBuffers() {
    const quadMesh = new Mesh({
      id: 'full-screen',
      indices: new Uint32Array([0, 1, 2, 2, 3, 0]),
      vertecies: new Float32Array([
        -1, -1, 0,
        -1, 1, 0,
        1, 1, 0,
        1, -1, 0
      ]),
      texCoords: new Float32Array([0, 0, 0]),
    });
    const material = new Material({
      id: 'full-screen',
      indicesBuffer: this._device.createBuffer({
        size: quadMesh.indices.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.INDEX,
        label: 'full-screen-indices-buffer'
      }),
      samplers: [],
      shaderModule: this._device.createShaderModule({
        code: this._loader.getShader('deferred/main')!
      }),
      textures: this._dPassResult!,
      uniformBuffers: [
        this._device.createBuffer({
          size: 4 * 4 * 4 * 3,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          label: UNIFORM_BUFFER_IDS.camera,
        }), //MVP,
        this._device.createBuffer({
          size: 4 * 4 + 4 * 4 + 4 * 4, //vec4 + vec4 + vec4
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
          label: UNIFORM_BUFFER_IDS.pointLights
        }) //point lights
      ],
      vertexBuffers: [
        this._device.createBuffer({
          size: quadMesh.vertecies.byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
        }),
        this._device.createBuffer({
          size: quadMesh.texCoords!.byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
        })
      ],
      vertexBuffersState: new VBSG()
        .add(VERTEX_BUFFER_IDS.positionBuffer, { format: 'float32x3' }, false)
        .add(VERTEX_BUFFER_IDS.texCoordsBuffer, { format: 'float32x2' }, false)
        .end(),
    })

    this._device.queue.writeBuffer(material.vertexBuffers[0], 0, quadMesh.vertecies);
    this._device.queue.writeBuffer(material.vertexBuffers[1], 0, quadMesh.texCoords!);
    this._device.queue.writeBuffer(material.indicesBuffer!, 0, quadMesh.indices);

    this._deferredRendererMesh = { mesh: quadMesh, material };

    this._meshes.push({ ...this._deferredRendererMesh, type: 'forward', renderPipeline: this._device.createRenderPipeline(material.pipelineDescriptor) })
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

    this._deferredRendererMesh && this._deferredRendererMesh.material.swapTextures(this._dPassResult);
  }

  async initDeferredRender() {
    this._dPassMaterial = Material.create({
      id: 'gbufferPass',
      indicesBuffer: null,
      samplers: [],
      textures: [],
      uniformBuffers: [],
      vertexBuffersState: [],
      vertexBuffers: [],
      shaderModule: this._device.createShaderModule({
        label: 'deferred/prepareBuffers',
        code: this._loader.getShader('deferred/prepareBuffers')!
      }),
      fragmentTargets: D_PASS_FRAGMENT_OUTS.map(() => ({ format: D_PASS_TEXTURE_FORMAT }))
    })

    this._dPassRenderPipeline = this._device.createRenderPipeline(this._dPassMaterial.pipelineDescriptor);
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
      this._dPassMaterial.swapTextures(m.material.textures);
      this._dPassMaterial.swapSamplers(m.material.samplers);

      const modelMatrix = m.mesh.modelMatrix;
      const viewMatrix = this._camera.viewMatrix;
      const projectionMatrix = this._camera.projectionMatrix;

      const cameraUB = m.material.uniformBuffers[0]
      this._device.queue.writeBuffer(cameraUB, 0, new Float32Array([...projectionMatrix, ...viewMatrix, ...modelMatrix]));
      this._dPassMaterial.swapUnifromBuffers([cameraUB]);
      this._dPassMaterial.swapVertexBuffers(m.material.vertexBuffers);
      this._dPassMaterial.swapIndicesBuffer(m.material.indicesBuffer!);

      this.renderMesh(m.mesh, this._dPassMaterial, this._dPassRenderPipeline!, passEncoder);
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
      const mesh = m.mesh;
      const material = m.material;

      const modelMatrix = mesh.modelMatrix;
      const viewMatrix = this._camera.viewMatrix;
      const projectionMatrix = this._camera.projectionMatrix;

      const pointLight: PointLight = this._ui?.lightsInfo!;

      material.uniformBuffers[0] && this._device.queue.writeBuffer(material.uniformBuffers[0], 0, new Float32Array([...projectionMatrix, ...viewMatrix, ...modelMatrix]));
      material.uniformBuffers[1] && this._device.queue.writeBuffer(material.uniformBuffers[1], 0, new Float32Array([...pointLight.position, ...pointLight.color, ...pointLight.intensityRadiusZZ]));

      const renderPipeline = m.renderPipeline;

      this.renderMesh(mesh, material, renderPipeline, passEncoder);
    }

    passEncoder.end();

    this._device.queue.submit([encoder.finish()]);
  }

  private renderMesh(mesh: Mesh, material: Material, renderPipeline: GPURenderPipeline, passEncoder: GPURenderPassEncoder) {
    const bindGroupsDescriptors = material.getBindGroupsDescriptors(renderPipeline);
    const bindGroups = bindGroupsDescriptors.map(desc => {
      return this._device.createBindGroup(desc.description)
    })

    passEncoder.setPipeline(renderPipeline);
    bindGroupsDescriptors.forEach(desc => {
      passEncoder.setBindGroup(desc.index, bindGroups[desc.index])
    })
    material.vertexBuffers.forEach((b, i) => {
      passEncoder.setVertexBuffer(i, b);
    })
    passEncoder.setIndexBuffer(material.indicesBuffer!, "uint32");
    passEncoder.drawIndexed(mesh.indices.length)
  }

  private _generateMaterialSettings(mesh: Mesh): MaterialConstructor {
    const createGPUTexture = (i: ImageBitmap, label: string): GPUTexture | undefined => {
      return i && this._device.createTexture({
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
        size: [mesh.textures!.color.width, mesh.textures!.color.height, 1],
        label
      })
    }

    const populateGPUTexture = (i: ImageBitmap | undefined, g: GPUTexture | undefined) => {
      i && g && this._device.queue.copyExternalImageToTexture({ source: i }, { texture: g }, [i.width, i.height])
    }

    const createGPUBuffer = (d: Float32Array | Uint32Array | undefined, i: GPUBufferUsageFlags, label: string): GPUBuffer | undefined => {
      return d && this._device.createBuffer({
        size: d.byteLength,
        usage: i,
        label
      })
    };

    const populateGPUBuffer = (b: GPUBuffer | undefined, d: Float32Array | Uint32Array | undefined) => {
      d && b && this._device.queue.writeBuffer(b, 0, d);
    }

    const verticesBuffer = createGPUBuffer(mesh.vertecies, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, VERTEX_BUFFER_IDS.positionBuffer);
    const indicesBuffer = createGPUBuffer(mesh.indices, GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST, INDICES_BUFFER_ID)!;
    const texCoordsBuffer = createGPUBuffer(mesh.texCoords, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, VERTEX_BUFFER_IDS.texCoordsBuffer);
    const normalsBuffer = createGPUBuffer(mesh.normals, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, VERTEX_BUFFER_IDS.normalsBuffer)!;
    const tangetsBuffer = createGPUBuffer(mesh.tangents, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, VERTEX_BUFFER_IDS.tangetsBuffer);

    const vertexBuffers = [
      verticesBuffer,
      texCoordsBuffer,
      normalsBuffer,
      tangetsBuffer,
    ].filter(e => e != undefined);

    const colorTexture = createGPUTexture(mesh.textures!.color, 'colorTexture');
    const normalTexture = createGPUTexture(mesh.textures!.normal, 'normalTexture');
    const emissiveTexture = createGPUTexture(mesh.textures!.emissive, 'emissiveTexture');
    const metalicRoughnessTexture = createGPUTexture(mesh.textures!.metalicRoughness, 'metalicRoughnessTexture');

    const textures = [colorTexture, normalTexture, emissiveTexture, metalicRoughnessTexture].filter(t => t != undefined);

    const colorTextureSampler = colorTexture && this._device.createSampler({ ...mesh.samplers!.color, label: TEXTURE_SAMPLERS_IDS.colorSampler });
    const emissiveTextureSampler = emissiveTexture && this._device.createSampler({ ...mesh.samplers!.emissive, label: TEXTURE_SAMPLERS_IDS.emissiveSampler });
    const metalicRoughnessTextureSampler = metalicRoughnessTexture && this._device.createSampler({ ...mesh.samplers!.metalicRoughness, label: TEXTURE_SAMPLERS_IDS.metalicRoughnessSampler });
    const normalTextureSampler = normalTexture && this._device.createSampler({ ...mesh.samplers!.normal, label: TEXTURE_SAMPLERS_IDS.normalSampler });

    const samplers = [colorTextureSampler, normalTextureSampler, emissiveTextureSampler, metalicRoughnessTextureSampler].filter(s => s != undefined);

    const vertexBuffersState = new VBSG()
      .add(VERTEX_BUFFER_IDS.positionBuffer, { format: 'float32x3' }, !verticesBuffer)
      .add(VERTEX_BUFFER_IDS.texCoordsBuffer, { format: 'float32x2' }, !texCoordsBuffer)
      .add(VERTEX_BUFFER_IDS.normalsBuffer, { format: 'float32x3' }, !normalsBuffer)
      .add(VERTEX_BUFFER_IDS.tangetsBuffer, { format: 'float32x4' }, !tangetsBuffer)
      .end();

    const uniformBuffers: GPUBuffer[] = [
      this._device.createBuffer({
        size: 4 * 4 * 4 * 3,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: UNIFORM_BUFFER_IDS.camera,
      }), //MVP,
      this._device.createBuffer({
        size: 4 * 4 + 4 * 4 + 4 * 4, //vec4 + vec4 + vec4
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        label: UNIFORM_BUFFER_IDS.pointLights
      }), //point lights
      this._device.createBuffer({
        size: 4 + 4 + 4 + 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: UNIFORM_BUFFER_IDS.settings,
      }) //settings
    ]

    this._device.queue.writeBuffer(uniformBuffers[2], 0, new Uint32Array([!colorTexture ? 1 : 0, !normalTexture ? 1 : 0, !emissiveTexture ? 1 : 0, !metalicRoughnessTexture ? 1 : 0]))

    populateGPUBuffer(indicesBuffer, mesh.indices)
    populateGPUBuffer(verticesBuffer, mesh.vertecies)
    populateGPUBuffer(texCoordsBuffer, mesh.texCoords)
    populateGPUBuffer(normalsBuffer, mesh.normals)
    populateGPUBuffer(tangetsBuffer, mesh.tangents)

    populateGPUTexture(mesh.textures!.color, colorTexture);
    populateGPUTexture(mesh.textures!.emissive, emissiveTexture);
    populateGPUTexture(mesh.textures!.normal, normalTexture);
    populateGPUTexture(mesh.textures!.metalicRoughness, metalicRoughnessTexture);

    const materialSettings: MaterialConstructor = {
      id: 'any',
      shaderModule: this._device.createShaderModule({
        code: this._loader.getShader('main')!,
        label: 'main',
      }),
      textures,
      samplers,
      uniformBuffers,
      vertexBuffersState,
      indicesBuffer,
      vertexBuffers,
    }

    return materialSettings;
  }

  async initForwardRender() {

  }

  async prepareMeshes(meshes: Mesh[]) {
    meshes.forEach(mesh => {
      const settings = this._generateMaterialSettings(mesh);
      const material = Material.create({
        ...settings, shaderModule: this._device.createShaderModule({
          code: this._loader.getShader('main')!,
          label: 'main',
        })
      });
      const renderPipeline = this._device.createRenderPipeline(material.pipelineDescriptor);
      const r = { mesh, material, renderPipeline }

      this._meshes.push(r);
    })
  }
}