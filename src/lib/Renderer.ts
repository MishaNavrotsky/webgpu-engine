import { vec4 } from "gl-matrix";
import Camera from "./Camera";
import Loader from "./Loader";
import Material, { MaterialConstructor } from "./Material";
import Mesh from "./Mesh";
import UI from "@/ui";
import VBSG from "./VertexBuffersStateGenerator";
import { INDICES_BUFFER_ID, UNIFORM_BUFFER_IDS, VERTEX_BUFFER_IDS, TEXTURE_IDS, TEXTURE_SAMPLERS_IDS } from "@/constants";
import { cloneDeep } from "lodash";

type PointLight = {
  position: vec4,
  color: vec4,
  intensityRadiusZZ: vec4,
}

type MeshData = Array<{ mesh: Mesh, material: Material, renderPipeline: GPURenderPipeline, type?: 'forward' | 'deferred' }>

const D_PASSES = ['deferred/albdeo', 'deferred/emissive', 'deferred/metalicRoughness', 'deferred/pNormals', 'deferred/position', 'deferred/vBiTangents', 'deferred/vNormals', 'deferred/vTangents'] as const;
type DPassName = typeof D_PASSES[number];
type DPassPrepObj = {
  [key in DPassName]: {
    material: Material,
    texture?: GPUTexture,
    renderPassDescriptor?: GPURenderPassDescriptor,
    renderPipeline?: GPURenderPipeline,
    requiredTexture?: typeof TEXTURE_IDS[keyof typeof TEXTURE_IDS],
    requiredSampler?: typeof TEXTURE_SAMPLERS_IDS[keyof typeof TEXTURE_SAMPLERS_IDS]

  };
}

type RendererConstructor = {
  camera: Camera, loader: Loader, canvas: HTMLCanvasElement
}

const D_PASS_TEXTURE_FORMAT: GPUTextureFormat = 'rgba32float'

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
  private _deferredDepthTexture!: GPUTexture;
  private _deferredDepthTextureView!: GPUTextureView;

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
        this.createTexturesForDPassPrepObj();
        this.createRenderPassDescriptorsForDPassPrepObj()

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

    this._device = await adapter.requestDevice();
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
    const gbuffers = Object.values(this._dPassPrepObj).map(v => v.texture) as GPUTexture[];
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
      textures: gbuffers,
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
      this._deferredRendererMesh.material.swapTextures(Object.values(this._dPassPrepObj).map(v => v.texture) as GPUTexture[]);
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
    this._deferredDepthTextureView = this._deferredDepthTexture?.createView();
  }

  private _passes = ['deferred/albdeo', 'deferred/emissive', 'deferred/metalicRoughness', 'deferred/pNormals', 'deferred/position', 'deferred/vBiTangents', 'deferred/vNormals', 'deferred/vTangents'] as const;
  private _dPassPrepObj!: DPassPrepObj;

  private createTexturesForDPassPrepObj() {
    Object.entries(this._dPassPrepObj || {}).forEach(([_, o]) => {
      o.texture && o.texture.destroy()
      o.texture = this._device.createTexture({
        label: _,
        format: D_PASS_TEXTURE_FORMAT,
        size: [this._canvas.width, this._canvas.height, 1],
        usage: GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_SRC |
          GPUTextureUsage.RENDER_ATTACHMENT,
      })
    })
  }

  private createRenderPassDescriptorsForDPassPrepObj() {
    const defDesc: GPURenderPassDescriptor = {
      label: 'createRenderPassDescriptorsForDPassPrepObj',
      colorAttachments: [
        {
          loadOp: "clear",
          storeOp: "store",
          view: this._context.getCurrentTexture().createView({ label: 'default view' }),

        },
      ],
      depthStencilAttachment: {
        view: this._deferredDepthTextureView,
        depthStoreOp: 'store',
        depthLoadOp: 'clear',
        depthClearValue: 1.0,
      }
    };

    this._dPassPrepObj[this._passes[0]].renderPassDescriptor = cloneDeep(defDesc);
    //@ts-ignore
    this._dPassPrepObj[this._passes[0]].renderPassDescriptor!.colorAttachments[0].view = this._dPassPrepObj[this._passes[0]].texture!.createView();

    for (let i = 1; i < this._passes.length; i++) {
      const ppo = this._dPassPrepObj[this._passes[i]]
      ppo.renderPassDescriptor = cloneDeep(defDesc);
      //@ts-ignore
      ppo.renderPassDescriptor!.colorAttachments[0].view = ppo.texture!.createView()
      ppo.renderPassDescriptor!.depthStencilAttachment!.depthStoreOp = 'store'
      ppo.renderPassDescriptor!.depthStencilAttachment!.depthLoadOp = 'load'
    }
  }

  async initDeferredRender() {
    const passesShaders = this._passes.map(p => this._loader.getShader(p)!)
    const compiledShaders = passesShaders.map((s, i) =>
      this._device.createShaderModule({ code: s, label: this._passes[i] })
    )

    this._dPassPrepObj = {
      'deferred/albdeo': {
        material: new Material({
          id: 'deferred/albdeo',
          indicesBuffer: null,
          samplers: [],
          shaderModule: compiledShaders[0],
          textures: [],
          uniformBuffers: [],
          vertexBuffers: [],
          vertexBuffersState: new VBSG()
            .add(VERTEX_BUFFER_IDS.positionBuffer, { format: 'float32x3' }, false)
            .add(VERTEX_BUFFER_IDS.texCoordsBuffer, { format: 'float32x2' }, false)
            .end(),
          fragmentFormat: D_PASS_TEXTURE_FORMAT
        }),
        requiredTexture: TEXTURE_IDS.colorTexture,
        requiredSampler: TEXTURE_SAMPLERS_IDS.colorSampler,
      },
      'deferred/emissive': {
        material: new Material({
          id: 'deferred/emissive',
          indicesBuffer: null,
          samplers: [],
          shaderModule: compiledShaders[1],
          textures: [],
          uniformBuffers: [],
          vertexBuffers: [],
          vertexBuffersState: new VBSG()
            .add(VERTEX_BUFFER_IDS.positionBuffer, { format: 'float32x3' }, false)
            .add(VERTEX_BUFFER_IDS.texCoordsBuffer, { format: 'float32x2' }, false)
            .end(),
          fragmentFormat: D_PASS_TEXTURE_FORMAT
        }),
        requiredTexture: TEXTURE_IDS.emissiveTexture,
        requiredSampler: TEXTURE_SAMPLERS_IDS.emissiveSampler,
      },
      "deferred/metalicRoughness": {
        material: new Material({
          id: 'deferred/metalicRoughness',
          indicesBuffer: null,
          samplers: [],
          shaderModule: compiledShaders[2],
          textures: [],
          uniformBuffers: [],
          vertexBuffers: [],
          vertexBuffersState: new VBSG()
            .add(VERTEX_BUFFER_IDS.positionBuffer, { format: 'float32x3' }, false)
            .add(VERTEX_BUFFER_IDS.texCoordsBuffer, { format: 'float32x2' }, false)
            .end(),
          fragmentFormat: D_PASS_TEXTURE_FORMAT
        }),
        requiredTexture: TEXTURE_IDS.metalicRoughnessTexture,
        requiredSampler: TEXTURE_SAMPLERS_IDS.metalicRoughnessSampler,
      },
      "deferred/pNormals": {
        material: new Material({
          id: 'deferred/pNormals',
          indicesBuffer: null,
          samplers: [],
          shaderModule: compiledShaders[3],
          textures: [],
          uniformBuffers: [],
          vertexBuffers: [],
          vertexBuffersState: new VBSG()
            .add(VERTEX_BUFFER_IDS.positionBuffer, { format: 'float32x3' }, false)
            .add(VERTEX_BUFFER_IDS.texCoordsBuffer, { format: 'float32x2' }, false)
            .end(),
          fragmentFormat: D_PASS_TEXTURE_FORMAT
        }),
        requiredTexture: TEXTURE_IDS.normalTexture,
        requiredSampler: TEXTURE_SAMPLERS_IDS.normalSampler,
      },
      "deferred/position": {
        material: new Material({
          id: 'deferred/position',
          indicesBuffer: null,
          samplers: [],
          shaderModule: compiledShaders[4],
          textures: [],
          uniformBuffers: [],
          vertexBuffers: [],
          vertexBuffersState: new VBSG()
            .add(VERTEX_BUFFER_IDS.positionBuffer, { format: 'float32x3' }, false)
            .end(),
          fragmentFormat: D_PASS_TEXTURE_FORMAT
        }),
      },
      "deferred/vBiTangents": {
        material: new Material({
          id: 'deferred/vBiTangents',
          indicesBuffer: null,
          samplers: [],
          shaderModule: compiledShaders[5],
          textures: [],
          uniformBuffers: [],
          vertexBuffers: [],
          vertexBuffersState: new VBSG()
            .add(VERTEX_BUFFER_IDS.positionBuffer, { format: 'float32x3' }, false)
            .add(VERTEX_BUFFER_IDS.normalsBuffer, { format: 'float32x3' }, false)
            .add(VERTEX_BUFFER_IDS.tangetsBuffer, { format: 'float32x4' }, false)
            .end(),
          fragmentFormat: D_PASS_TEXTURE_FORMAT,
        }),
      },
      "deferred/vNormals": {
        material: new Material({
          id: 'deferred/vNormals',
          indicesBuffer: null,
          samplers: [],
          shaderModule: compiledShaders[6],
          textures: [],
          uniformBuffers: [],
          vertexBuffers: [],
          vertexBuffersState: new VBSG()
            .add(VERTEX_BUFFER_IDS.positionBuffer, { format: 'float32x3' }, false)
            .add(VERTEX_BUFFER_IDS.normalsBuffer, { format: 'float32x3' }, false)
            .end(),
          fragmentFormat: D_PASS_TEXTURE_FORMAT,
        }),
      },
      "deferred/vTangents": {
        material: new Material({
          id: 'deferred/vTangents',
          indicesBuffer: null,
          samplers: [],
          shaderModule: compiledShaders[7],
          textures: [],
          uniformBuffers: [],
          vertexBuffers: [],
          vertexBuffersState: new VBSG()
            .add(VERTEX_BUFFER_IDS.positionBuffer, { format: 'float32x3' }, false)
            .add(VERTEX_BUFFER_IDS.tangetsBuffer, { format: 'float32x4' }, false)
            .end(),
          fragmentFormat: D_PASS_TEXTURE_FORMAT
        }),
      }
    }

    this._dPassPrepObj[this._passes[0]].material.enableDepthWrite(true);
    this._dPassPrepObj[this._passes[0]].renderPipeline = this._device.createRenderPipeline(this._dPassPrepObj[this._passes[0]].material.pipelineDescriptor);
    for (var i = 1; i < this._passes.length; i++) {
      this._dPassPrepObj[this._passes[i]].material.enableDepthWrite(false);
      this._dPassPrepObj[this._passes[i]].material.setDepthCompare('equal');
      this._dPassPrepObj[this._passes[i]].renderPipeline = this._device.createRenderPipeline(this._dPassPrepObj[this._passes[i]].material.pipelineDescriptor);
    }

    this.createTexturesForDPassPrepObj();
    this.createRenderPassDescriptorsForDPassPrepObj();
    this.prepareMeshForGBuffers();
  }

  private async renderGBuffers() {
    const encoder = this._device.createCommandEncoder({ label: 'deferred' });
    for (let i = 0; i < this._passes.length; i++) {
      const passId = this._passes[i];
      const ppo = this._dPassPrepObj[passId];
      const passEncoder = encoder.beginRenderPass(ppo.renderPassDescriptor!)
      const vertexBuffersStateLabels = ppo.material.vertexBuffersState.map(vbs => vbs.label);

      for (const m of this._meshes) {
        const vbs: (GPUBuffer | undefined)[] = [];
        for (const label of vertexBuffersStateLabels) {
          const vb = m.material.vertexBuffers.find(vb => vb.label === label)
          vbs.push(vb)
        }

        if (vbs.includes(undefined)) continue;

        const texture = ppo.requiredTexture && m.material.textures.find(t => t.label === ppo.requiredTexture)
        if (ppo.requiredTexture && !texture) continue;

        const sampler = ppo.requiredSampler && m.material.samplers.find(t => t.label === ppo.requiredSampler)
        if (ppo.requiredSampler && !sampler) continue;

        texture && ppo.material.swapTextures([texture]);
        sampler && ppo.material.swapSamplers([sampler]);

        const modelMatrix = m.mesh.modelMatrix;
        const viewMatrix = this._camera.viewMatrix;
        const projectionMatrix = this._camera.projectionMatrix;

        const cameraUB = m.material.uniformBuffers[0]
        this._device.queue.writeBuffer(cameraUB, 0, new Float32Array([...projectionMatrix, ...viewMatrix, ...modelMatrix]));
        ppo.material.swapUnifromBuffers([cameraUB]);

        ppo.material.swapVertexBuffers(vbs as GPUBuffer[]);

        ppo.material.swapIndicesBuffer(m.material.indicesBuffer!);

        const renderPipeline = ppo.renderPipeline!;
        this.renderMesh(m.mesh, ppo.material, renderPipeline, passEncoder);
      }
      passEncoder.end();
    }
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

    const encoder = this._device.createCommandEncoder();
    const passEncoder = encoder.beginRenderPass(renderPassDescriptor)


    for (const m of this._meshes) {
      if (m.type === 'forward') continue;
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