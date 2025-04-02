import { mat4 } from "gl-matrix";
import Camera from "./Camera";
import Loader from "./Loader";
import Material from "./Material";
import Mesh from "./Mesh";
import GLBMesh from "./GLBMesh";

type MeshData = Array<{ mesh: Mesh, material: Material }>

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
        const material = m.material;

        const modelMatrix = mesh.modelMatrix;
        const uniformPVM = mat4.mul(mat4.create(), mPV, modelMatrix)

        this._device.queue.writeBuffer(material.uniformBuffers[0], 0, new Float32Array(uniformPVM));

        const renderPipeline = this._device.createRenderPipeline(material.pipelineDescriptor);

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
        passEncoder.setIndexBuffer(material.indicesBuffer, "uint32");
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


    const model = await new GLBMesh(await this._loader.getGLB('tyan')!).resolveMeshesToBytes()

    const readyMaterial = (mesh: Mesh): Material => {
      const createGPUTexture = (i: ImageBitmap, label: string): GPUTexture | undefined => {
        return i && this._device.createTexture({
          format: 'rgba8unorm',
          usage: GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT,
          size: [mesh.textures.color.width, mesh.textures.color.height, 1],
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

      const verticesBuffer = createGPUBuffer(mesh.vertecies, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, 'positionBuffer');
      const indicesBuffer = createGPUBuffer(mesh.indices, GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST, 'indicesBuffer')!;
      const texCoordsBuffer = createGPUBuffer(mesh.texCoords, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, 'texCoordsBuffer');
      const normalsBuffer = createGPUBuffer(mesh.normals, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, 'normalsBuffer')!;
      const tangetsBuffer = createGPUBuffer(mesh.tangents, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, 'tangetsBuffer');

      const vertexBuffers = [
        verticesBuffer,
        texCoordsBuffer,
        normalsBuffer,
        tangetsBuffer,
      ].filter(e => e != undefined);

      const colorTexture = createGPUTexture(mesh.textures.color, 'colorTexture');
      const normalTexture = createGPUTexture(mesh.textures.normal, 'normalTexture');
      const emissiveTexture = createGPUTexture(mesh.textures.emissive, 'emissiveTexture');
      const metalicRoughnessTexture = createGPUTexture(mesh.textures.metalicRoughness, 'metalicRoughnessTexture');

      const textures = [colorTexture, normalTexture, emissiveTexture, metalicRoughnessTexture].filter(t => t != undefined);

      const colorTextureSampler = colorTexture && this._device.createSampler(mesh.samplers.color);
      const emissiveTextureSampler = emissiveTexture && this._device.createSampler(mesh.samplers.emissive);
      const metalicRoughnessTextureSampler = metalicRoughnessTexture && this._device.createSampler(mesh.samplers.metalicRoughness);
      const normalTextureSampler = normalTexture && this._device.createSampler(mesh.samplers.normal);

      const samplers = [colorTextureSampler, normalTextureSampler, emissiveTextureSampler, metalicRoughnessTextureSampler].filter(s => s != undefined);

      const resolveShaderName = (vertexBuffers: GPUBuffer[], textures: GPUTexture[]) => {
        const vbl = vertexBuffers.map(b => b.label[0]);
        const tbl = textures.map(t => t.label[0]);

        return `${vbl.join('')}_${tbl.join('')}_material`
      }

      const material = new Material({
        id: 'any',
        shaderModule: this._device.createShaderModule({
          code: this._loader.getShader(resolveShaderName(vertexBuffers, textures))!,
        }),
        textures,
        samplers,
        uniformBuffers: [
          this._device.createBuffer({
            size: 4 * 4 * 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          })
        ],
        //@ts-ignore
        vertexBuffersState: [
          verticesBuffer && {
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
          texCoordsBuffer && {
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
          normalsBuffer && {
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
          tangetsBuffer && {
            attributes: [
              {
                shaderLocation: 3, // tangents
                offset: 0,
                format: "float32x4",
              },
            ],
            arrayStride: 16,
            stepMode: "vertex",
          },
        ].filter(e => e != undefined),
        indicesBuffer,
        vertexBuffers,
      })

      populateGPUBuffer(indicesBuffer, mesh.indices)
      populateGPUBuffer(verticesBuffer, mesh.vertecies)
      populateGPUBuffer(texCoordsBuffer, mesh.texCoords)
      populateGPUBuffer(normalsBuffer, mesh.normals)
      populateGPUBuffer(tangetsBuffer, mesh.tangents)

      populateGPUTexture(mesh.textures.color, colorTexture);
      populateGPUTexture(mesh.textures.emissive, emissiveTexture);
      populateGPUTexture(mesh.textures.normal, normalTexture);
      populateGPUTexture(mesh.textures.metalicRoughness, metalicRoughnessTexture);

      return material;
    }

    model.forEach(m => {
      const primitive = m.primitives[0]
      const t = new Mesh({
        id: 'any',
        indices: primitive.indices,
        textures: {
          color: primitive.colorTexture?.image,
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

      const r = { mesh: t, material: readyMaterial(t) }
      console.log(r);

      this._meshes.push(r);
    })
  }
}