import { mat4 } from "gl-matrix";
import Camera from "./Camera";
import Loader from "./Loader";
import Material from "./Material";
import Mesh from "./Mesh";
import GLBMesh from "./GLBMesh";

export default class Renderer {
  private _meshes: Array<{ mesh: Mesh, verticesBuffer: GPUBuffer, indicesBuffer: GPUBuffer }> = [];
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
      };

      const encoder = this._device.createCommandEncoder();
      const passEncoder = encoder.beginRenderPass(renderPassDescriptor)


      for (const m of this._meshes) {
        const mesh = m.mesh;
        const verticesBuffer = m.verticesBuffer;
        const indicesBuffer = m.indicesBuffer;

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
        };

        const renderPipeline = this._device.createRenderPipeline(pipelineDescriptor);
        const bindGroup = this._device.createBindGroup({
          layout: renderPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: material.uniformBuffers[0] } },
          ]
        })
        passEncoder.setPipeline(renderPipeline);

        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.setVertexBuffer(0, verticesBuffer);
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
        textures: [],
        vertecies: m.primitives[0].attributes.POSITION
      })
      triangleMesh.scale = [0.05, 0.05, 0.05]

      const readyMesh = {
        mesh: triangleMesh,
        verticesBuffer: this._device.createBuffer({
          size: triangleMesh.vertecies.byteLength,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        }),
        indicesBuffer: this._device.createBuffer({
          size: triangleMesh.indices.byteLength,
          usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
        })
      };

      this._device.queue.writeBuffer(readyMesh.indicesBuffer, 0, triangleMesh.indices);
      this._device.queue.writeBuffer(readyMesh.verticesBuffer, 0, triangleMesh.vertecies);



      this._meshes.push(readyMesh);
    })
  }
}