import { mat4 } from "gl-matrix";
import Camera from "./Camera";
import Loader from "./Loader";
import Material from "./Material";
import Mesh from "./Mesh";
import GLBMesh from "./GLBMesh";

type MeshData = Array<{ mesh: Mesh, verticesBuffer: GPUBuffer, indicesBuffer: GPUBuffer, texCoordsBuffer: GPUBuffer, textures: { color?: GPUTexture }, samplers: { color?: GPUSampler } }>

export default class Renderer {
  private _meshes: MeshData = [];
  private _camera: Camera;
  private _loader: Loader;
  private _canvas: HTMLCanvasElement
  private _fov: number = 45;
  private _lastCpuTime = 0;
  private _lastGpuTime = 0;
  constructor(camera: Camera, loader: Loader, canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    this._loader = loader;
    this._camera = camera;
    this._camera.init(canvas.width, canvas.height, this._fov);

    const resizeObserver = new ResizeObserver(() => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      this._camera.setPerspective(canvas.width, canvas.height, camera.fov)
    });
    resizeObserver.observe(canvas);
  }

  getTimings() {
    return { cpu: this._lastCpuTime, gpu: this._lastGpuTime }
  }

  async render(dT: number) {
    const cpuTimeStart = performance.now()
    {
      const mPV = this._camera.calculate(dT);


      const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [
          {
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
        const mesh = m.mesh;
        const verticesBuffer = m.verticesBuffer;
        const indicesBuffer = m.indicesBuffer;
        const texCoordsBuffer = m.texCoordsBuffer;
        if (!m.textures.color) continue;

        const material = mesh.material;
        const modelMatrix = mesh.modelMatrix;
        const uniformPVM = mat4.mul(mat4.create(), mPV, modelMatrix)

        this._device.queue.writeBuffer(material.uniformBuffers[0], 0, new Float32Array(uniformPVM));


        const vertexBuffers: GPUVertexState['buffers'] = [
          {
            attributes: [
              {
                shaderLocation: 0, // position
                offset: 0,
                format: "float32x3",
              },
              // {
              //   shaderLocation: 1, // color
              //   offset: 12,
              //   format: "float32x3",
              // },
            ],
            arrayStride: 12,
            stepMode: "vertex",
          },
          {
            attributes: [
              {
                shaderLocation: 1, // position
                offset: 0,
                format: "float32x2",
              },
            ],
            arrayStride: 8,
            stepMode: "vertex",
          }
        ];

        const pipelineDescriptor: GPURenderPipelineDescriptor = {
          vertex: {
            module: material.shaderModule,
            entryPoint: "vertex_main",
            buffers: vertexBuffers,
          },
          fragment: {
            module: material.shaderModule,
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
            cullMode: 'none'
          },
          multisample: {
            count: 1,
          },
          layout: "auto",
          depthStencil: {
            format: 'depth24plus',
            depthWriteEnabled: true,
            depthCompare: 'less',
          }
        };

        const renderPipeline = this._device.createRenderPipeline(pipelineDescriptor);
        const bindGroupCamera = this._device.createBindGroup({
          layout: renderPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: material.uniformBuffers[0] } },
          ]
        })
        const bindGroupTextures = this._device.createBindGroup({
          layout: renderPipeline.getBindGroupLayout(1),

          entries: [
            { binding: 0, resource: m.textures.color!.createView() },
          ]
        })
        const bindGroupSampler = this._device.createBindGroup({
          layout: renderPipeline.getBindGroupLayout(2),
          entries: [
            { binding: 0, resource: m.samplers.color! },
          ]
        })

        passEncoder.setPipeline(renderPipeline);
        passEncoder.setBindGroup(0, bindGroupCamera);
        passEncoder.setBindGroup(1, bindGroupTextures);
        passEncoder.setBindGroup(2, bindGroupSampler);
        passEncoder.setVertexBuffer(0, verticesBuffer);
        passEncoder.setVertexBuffer(1, texCoordsBuffer)
        passEncoder.setIndexBuffer(indicesBuffer, "uint32");
        passEncoder.drawIndexed(mesh.indices.length)
      }

      passEncoder.end();

      this._device.queue.submit([encoder.finish()]);
    }
    this._lastCpuTime = performance.now() - cpuTimeStart;

    const gpuTimeStart = performance.now();
    await this._device.queue.onSubmittedWorkDone()
    this._lastGpuTime = performance.now() - gpuTimeStart;
  }

  private _device!: GPUDevice;
  private _context!: GPUCanvasContext;
  private _depthTexture!: GPUTexture;
  private _depthTextureView!: GPUTextureView;
  private _depthTextureSampler!: GPUSampler;


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
    this._depthTexture = this._device.createTexture({
      format: 'depth24plus',
      size: [this._canvas.width, this._canvas.height],
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this._depthTextureView = this._depthTexture.createView();
    this._depthTextureSampler = this._device.createSampler({
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
      addressModeW: 'clamp-to-edge',
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'nearest',
      compare: 'less-equal',
      lodMinClamp: 0,
      lodMaxClamp: 100,
    })


    const defaultMaterial = new Material({
      id: 'defaultMaterial',
      shaderModule: this._device.createShaderModule({
        code: this._loader.getShader('defaultMaterial')!,
      }),
      textures: [],
      uniformBuffers: [
        this._device.createBuffer({
          size: 4 * 4 * 4,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })
      ]
    })


    const model = await new GLBMesh(await this._loader.getGLB('tyan')!).resolveMeshesToBytes()

    model.forEach(m => {
      const triangleMesh = new Mesh({
        id: 'triangle1',
        indices: m.primitives[0].indices,
        material: defaultMaterial,
        textures: { color: m.primitives[0].colorTexture },
        vertecies: m.primitives[0].attributes.POSITION,
        texCoords: m.primitives[0].attributes.TEXCOORD_0,
      })
      triangleMesh.scale = [0.05, 0.05, 0.05]

      const readyMesh: MeshData[0] = {
        mesh: triangleMesh,
        verticesBuffer: this._device.createBuffer({
          size: triangleMesh.vertecies.byteLength,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        }),
        indicesBuffer: this._device.createBuffer({
          size: triangleMesh.indices.byteLength,
          usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
        }),
        texCoordsBuffer: this._device.createBuffer({
          size: triangleMesh.texCoords.byteLength,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        }),
        textures: {
          color: m.primitives[0].colorTexture && this._device.createTexture({
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING |
              GPUTextureUsage.COPY_DST |
              GPUTextureUsage.RENDER_ATTACHMENT,
            size: [m.primitives[0].colorTexture.image.width, m.primitives[0].colorTexture.image.height, 1]
          })
        },
        samplers: {
          color: m.primitives[0].colorTexture && this._device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
            addressModeW: 'clamp-to-edge',
            mipmapFilter: 'linear',
          })
        }
      };

      this._device.queue.writeBuffer(readyMesh.indicesBuffer, 0, triangleMesh.indices);
      this._device.queue.writeBuffer(readyMesh.verticesBuffer, 0, triangleMesh.vertecies);
      this._device.queue.writeBuffer(readyMesh.texCoordsBuffer, 0, triangleMesh.texCoords);
      m.primitives[0].colorTexture && this._device.queue.copyExternalImageToTexture({ source: m.primitives[0].colorTexture.image }, { texture: readyMesh.textures.color! }, [m.primitives[0].colorTexture.image.width, m.primitives[0].colorTexture.image.height]);
      this._meshes.push(readyMesh);
    })
  }
}