import { mat4 } from "gl-matrix";
import Camera from "./Camera";
import Loader from "./Loader";
import Material from "./Material";
import Mesh from "./Mesh";
import GLBMesh from "./GLBMesh";

type MeshData = Array<{
  mesh: Mesh,
  verticesBuffer: GPUBuffer,
  indicesBuffer: GPUBuffer,
  texCoordsBuffer: GPUBuffer,
  normalsBuffer: GPUBuffer,
  tangetsBuffer?: GPUBuffer,
  textures: { color?: GPUTexture, normal?: GPUTexture, emissive?: GPUTexture, metalicRoughness?: GPUTexture },
  samplers: { color?: GPUSampler, normal?: GPUSampler, emissive?: GPUSampler, metalicRoughness?: GPUSampler },
}>

export default class Renderer {
  private _meshes: MeshData = [];
  private _camera: Camera;
  private _loader: Loader;
  private _canvas: HTMLCanvasElement
  private _fov: number = 90;
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

      this.createDepthTexture();
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
        const mesh = m.mesh;
        const verticesBuffer = m.verticesBuffer;
        const indicesBuffer = m.indicesBuffer;
        const texCoordsBuffer = m.texCoordsBuffer;
        const normalsBuffer = m.normalsBuffer;
        const tangentsBuffer = m.texCoordsBuffer

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
            ],
            arrayStride: 12,
            stepMode: "vertex",
          },
          {
            attributes: [
              {
                shaderLocation: 1, // texcoords
                offset: 0,
                format: "float32x2",
              },
            ],
            arrayStride: 8,
            stepMode: "vertex",
          },
          {
            attributes: [
              {
                shaderLocation: 2, // normals
                offset: 0,
                format: "float32x3",
              },
            ],
            arrayStride: 12,
            stepMode: "vertex",
          },
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
            // cullMode: 'back'
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
        passEncoder.setVertexBuffer(1, texCoordsBuffer);
        passEncoder.setVertexBuffer(2, normalsBuffer);
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

  private createDepthTexture() {
    this._depthTexture = this._device?.createTexture({
      format: 'depth24plus',
      size: [this._canvas.width, this._canvas.height],
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      dimension: '2d',
    });
    this._depthTextureView = this._depthTexture?.createView();
  }

  private _device!: GPUDevice;
  private _context!: GPUCanvasContext;
  private _depthTexture!: GPUTexture;
  private _depthTextureView!: GPUTextureView;

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
      ],
      samplers: [],
      vertexBuffersState: [
        {
          attributes: [
            {
              shaderLocation: 0, // position
              offset: 0,
              format: "float32x3",
            },
          ],
          arrayStride: 12,
          stepMode: "vertex",
        },
        {
          attributes: [
            {
              shaderLocation: 1, // texcoords
              offset: 0,
              format: "float32x2",
            },
          ],
          arrayStride: 8,
          stepMode: "vertex",
        },
        {
          attributes: [
            {
              shaderLocation: 2, // normals
              offset: 0,
              format: "float32x3",
            },
          ],
          arrayStride: 12,
          stepMode: "vertex",
        },
      ]
    })


    const model = await new GLBMesh(await this._loader.getGLB('tyan')!).resolveMeshesToBytes()

    const readyMesh = (m: Mesh) => {
      const createGPUTexture = (i: ImageBitmap) => {
        return i && this._device.createTexture({
          format: 'rgba8unorm',
          usage: GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT,
          size: [m.textures.color.width, m.textures.color.height, 1]
        })
      }

      const populateGPUTexture = (i: ImageBitmap | undefined, g: GPUTexture | undefined) => {
        i && g && this._device.queue.copyExternalImageToTexture({ source: i }, { texture: g }, [i.width, i.height])
      }

      const createGPUBuffer = (d: Float32Array | Uint32Array | undefined, i: GPUBufferUsageFlags): GPUBuffer | undefined => {
        return d && this._device.createBuffer({
          size: d.byteLength,
          usage: i,
        })
      };

      const populateGPUBuffer = (b: GPUBuffer | undefined, d: Float32Array | Uint32Array | undefined) => {
        d && b && this._device.queue.writeBuffer(b, 0, d);
      }

      const readyMesh: MeshData[0] = {
        mesh: m,
        verticesBuffer: createGPUBuffer(m.vertecies, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST)!,
        indicesBuffer: createGPUBuffer(m.indices, GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST)!,
        texCoordsBuffer: createGPUBuffer(m.texCoords, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST)!,
        normalsBuffer: createGPUBuffer(m.normals, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST)!,
        tangetsBuffer: createGPUBuffer(m.tangents, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST),
        textures: {
          color: createGPUTexture(m.textures.color),
          normal: createGPUTexture(m.textures.normal),
          emissive: createGPUTexture(m.textures.emissive),
          metalicRoughness: createGPUTexture(m.textures.metalicRoughness),
        },
        samplers: {
          color: m.textures.color && this._device.createSampler(m.samplers.color),
          emissive: m.textures.emissive && this._device.createSampler(m.samplers.emissive),
          metalicRoughness: m.textures.metalicRoughness && this._device.createSampler(m.samplers.metalicRoughness),
          normal: m.textures.normal && this._device.createSampler(m.samplers.normal),
        }
      };

      populateGPUBuffer(readyMesh.indicesBuffer, m.indices)
      populateGPUBuffer(readyMesh.verticesBuffer, m.vertecies)
      populateGPUBuffer(readyMesh.texCoordsBuffer, m.texCoords)
      populateGPUBuffer(readyMesh.normalsBuffer, m.normals)
      populateGPUBuffer(readyMesh.tangetsBuffer, m.tangents)

      populateGPUTexture(m.textures.color, readyMesh.textures.color);
      populateGPUTexture(m.textures.emissive, readyMesh.textures.emissive);
      populateGPUTexture(m.textures.normal, readyMesh.textures.normal);
      populateGPUTexture(m.textures.metalicRoughness, readyMesh.textures.metalicRoughness);

      return readyMesh;
    }

    model.forEach(m => {
      const primitive = m.primitives[0]
      const t = new Mesh({
        id: 'any',
        indices: primitive.indices,
        material: defaultMaterial,
        textures: {
          color: primitive.colorTexture?.image || this._loader.getDefaultTexture(),
          normal: primitive.normalTexture?.image,
          emissive: primitive.emissiveTexture?.image,
          metalicRoughness: primitive.metallicRoughnessTexture?.image
        },
        vertecies: m.primitives[0].attributes.POSITION,
        texCoords: m.primitives[0].attributes.TEXCOORD_0,
        tangents: m.primitives[0].attributes.TANGENT,
        normals: m.primitives[0].attributes.NORMAL,
        samplers: {
          color: primitive.colorTexture?.sampler || {},
          normal: primitive.normalTexture?.sampler,
          emissive: primitive.emissiveTexture?.sampler,
          metalicRoughness: primitive.metallicRoughnessTexture?.sampler
        }
      })
      t.scale = [0.01, 0.01, 0.01]

      console.log(primitive);

      this._meshes.push(readyMesh(t));
    })
  }
}