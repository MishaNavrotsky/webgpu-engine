import Camera from "./lib/Camera";
import Controls from "./lib/Controls";
import Loader from "./lib/Loader";
import Engine from "./lib/Engine";
import Renderer from "./lib/Renderer";
import UI from "./ui";

const canvas = document.getElementsByTagName('canvas')[0];
canvas.addEventListener('click', async () => {
  await canvas.requestPointerLock({
    unadjustedMovement: true,
  });
})


// async function init() {
//   await loader.load();

//   if (!navigator.gpu) {
//     throw Error("WebGPU not supported.");
//   }

//   const adapter = await navigator.gpu.requestAdapter();
//   if (!adapter) {
//     throw Error("Couldn't request WebGPU adapter.");
//   }

//   const device = await adapter.requestDevice();
//   const shaderModule = device.createShaderModule({
//     code: shaders,
//   });

//   const context = canvas.getContext('webgpu')!;

//   context.configure({
//     device: device,
//     format: navigator.gpu.getPreferredCanvasFormat(),
//     alphaMode: "opaque",
//   });

//   const model = loader.get('alicev2rigged')!;
//   const mesh = new Mesh(model);

//   const resolvedMesh = await mesh.resolveMeshesToBytes();

//   const meshes: Array<any> = [];
//   resolvedMesh.forEach((m: any) => {
//     console.log(m)
//     const pVertices = m.primitives[0].attributes.POSITION;
//     const pIndices = m.primitives[0].indices;
//     const pTexCoords = m.primitives[0].attributes.TEXCOORD_0
//     const buffers: {
//       pVertices: any,
//       pIndices: any,
//       vertices: GPUBuffer,
//       indices: GPUBuffer,
//       colorTexture: GPUTexture | undefined,
//       colorTextureSampler: any,
//       textureCoordinats: GPUBuffer,
//       textureCoordinatsTexture: any,
//     } = {
//       pVertices,
//       pIndices,
//       vertices: device.createBuffer({
//         size: pVertices.byteLength,
//         usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
//       }),
//       indices: device.createBuffer({
//         size: pIndices.byteLength,
//         usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
//       }),
//       colorTexture: undefined,
//       colorTextureSampler: undefined,
//       textureCoordinatsTexture: undefined,
//     }

//     if (m.primitives[0].colorTexture) {
//       buffers.colorTextureSampler = m.primitives[0].colorTexture.sampler;
//       const image = m.primitives[0].colorTexture.image;
//       buffers.colorTexture = device.createTexture({
//         size: [image.width, image.height, 1],
//         format: "rgba8unorm",
//         usage: GPUTextureUsage.TEXTURE_BINDING |
//           GPUTextureUsage.COPY_DST |
//           GPUTextureUsage.RENDER_ATTACHMENT,
//       })

//       device.queue.copyExternalImageToTexture(
//         { source: image },
//         { texture: buffers.colorTexture },
//         [image.width, image.height],
//       );
//     }


//     device.queue.writeBuffer(buffers.vertices, 0, buffers.pVertices);
//     device.queue.writeBuffer(buffers.indices, 0, buffers.pIndices);


//     meshes.push(buffers);
//   })

//   const vertexBuffers: GPUVertexState['buffers'] = [
//     {
//       attributes: [
//         {
//           shaderLocation: 0, // position
//           offset: 0,
//           format: "float32x3",
//         },
//         // {
//         //   shaderLocation: 1, // color
//         //   offset: 12,
//         //   format: "float32x3",
//         // },
//       ],
//       arrayStride: 12,
//       stepMode: "vertex",
//     },
//   ];

//   const pipelineDescriptor: GPURenderPipelineDescriptor = {
//     vertex: {
//       module: shaderModule,
//       entryPoint: "vertex_main",
//       buffers: vertexBuffers,
//     },
//     fragment: {
//       module: shaderModule,
//       entryPoint: "fragment_main",
//       targets: [
//         {
//           format: navigator.gpu.getPreferredCanvasFormat(),
//         },
//       ],
//     },
//     primitive: {
//       topology: "triangle-list",
//       frontFace: "ccw",
//       cullMode: 'none'
//     },
//     multisample: {
//       count: 1,
//     },
//     layout: "auto",
//     depthStencil: {
//       format: 'depth24plus-stencil8',
//       depthWriteEnabled: true,
//       depthCompare: "less-equal",
//       stencilFront: {
//         compare: 'always',
//         passOp: 'keep',
//       },
//       stencilBack: {
//         compare: 'always',
//         passOp: 'keep'
//       }
//     }
//   };

//   const renderPipeline = device.createRenderPipeline(pipelineDescriptor);

//   const uniformBuffer = device.createBuffer({
//     size: 2 * 4,
//     usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
//   });
//   const cameraUniformBuffer = device.createBuffer({
//     size: 4 * 4 * 3 * 4,
//     usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
//   })
//   const bindGroup = device.createBindGroup({
//     layout: renderPipeline.getBindGroupLayout(0),
//     entries: [
//       { binding: 0, resource: { buffer: uniformBuffer } },
//       { binding: 1, resource: { buffer: cameraUniformBuffer } }
//     ]
//   })
//   const unifromValues = new Float32Array(2);
//   const cameraUniformValues = new Float32Array(4 * 4 * 3);
//   const camera = new Camera(canvas.width, canvas.height, 90);
//   const a = [0, 0]
//   document.onmousemove = (e) => {
//     unifromValues.set([e.clientX, e.clientY]);
//     a[0] += e.movementX / 100;
//     a[1] -= e.movementY / 100;

//     if (a[1] > 1.55334) {
//       a[1] = 1.55334
//     }

//     if (a[1] < -1.55334) {
//       a[1] = -1.55334
//     }

//     const direction = new Float32Array([0, 0, 0])
//     direction[0] = Math.cos(a[0]) * Math.cos(a[1]);
//     direction[1] = Math.sin(a[1]);
//     direction[2] = Math.sin(a[0]) * Math.cos(a[1]);
//     vec3.normalize(direction, direction);
//     camera.lookAt(direction)
//   }

//   const checkInputs = (dT: number) => {
//     const p = camera.position;
//     const l = camera.look;

//     const speed = 0.22 * dT * (controls.has('shift') ? 8 : 1);

//     if (controls.has('w')) {
//       vec3.add(p, p, vec3.scale(l, l, speed))

//     }

//     if (controls.has('s')) {
//       vec3.sub(p, p, vec3.scale(l, l, speed))

//     }

//     if (controls.has('a')) {
//       const v = vec3.cross(l, l, [0, 1, 0]);
//       const n = vec3.normalize(v, v);
//       vec3.sub(p, p, vec3.scale(n, n, speed))
//     }

//     if (controls.has('d')) {
//       const v = vec3.cross(l, l, [0, 1, 0]);
//       const n = vec3.normalize(v, v);
//       vec3.add(p, p, vec3.scale(n, n, speed))
//     }

//     camera.position = p;
//   }

//   const calculateCamera = () => {
//     let model = mat4.create();

//     cameraUniformValues.set([...model, ...camera.viewMatrix, ...camera.projectionMatrix])
//   }


// const depthStencilTexture = device.createTexture({
//   format: 'depth24plus-stencil8',
//   size: {
//     width: canvas.width,
//     height: canvas.height,
//     depthOrArrayLayers: 1
//   },
//   usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST,
// })
//   const depthStencilView = depthStencilTexture.createView({
//     format: 'depth24plus-stencil8',
//     dimension: '2d',
//     aspect: 'all'
//   })

//   let startTime = 0;
//   let endTime = 0;
//   const view = context.getCurrentTexture().createView();
//   function render() {
//     const dT = endTime - startTime;
//     startTime = performance.now()
//     checkInputs(dT);

//     const renderPassDescriptor: GPURenderPassDescriptor = {
//       colorAttachments: [
//         {
//           loadOp: "clear",
//           storeOp: "store",
//           view: context.getCurrentTexture().createView(),
//         },
//       ],
//       depthStencilAttachment: {
//         view: depthStencilView,
//         depthClearValue: 1.0,
//         depthLoadOp: 'clear',
//         depthStoreOp: 'store',
//         depthReadOnly: false,

//         stencilStoreOp: 'store',
//         stencilLoadOp: 'clear',
//       }
//     };
//     calculateCamera();

//     device.queue.writeBuffer(uniformBuffer, 0, unifromValues);
//     device.queue.writeBuffer(cameraUniformBuffer, 0, cameraUniformValues);


//     const commandEncoder = device.createCommandEncoder();
//     const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
//     passEncoder.setPipeline(renderPipeline);
//     passEncoder.setBindGroup(0, bindGroup);
//     meshes.forEach(m => {
//       if (m.colorTexture) {
//         const sampler = device.createSampler({
//           magFilter: 'nearest',
//           minFilter: 'nearest',
//           addressModeU: 'repeat',
//           addressModeV: 'repeat',
//           addressModeW: 'repeat',
//         });
//         const texturesBindGroup = device.createBindGroup({
//           layout: renderPipeline.getBindGroupLayout(1),
//           entries: [
//             { binding: 0, resource: sampler },
//             { binding: 1, resource: m.colorTexture.createView() },
//           ]
//         })
//         passEncoder.setBindGroup(1, texturesBindGroup);
//       } else {
//         return;
//       }
//       passEncoder.setVertexBuffer(0, m.vertices);
//       passEncoder.setIndexBuffer(m.indices, "uint32");
//       passEncoder.drawIndexed(m.pIndices.length)
//     })
//     passEncoder.end();

//     device.queue.submit([commandEncoder.finish()]);

//     device.queue.onSubmittedWorkDone().then(() => requestAnimationFrame(() => {
//       endTime = performance.now()
//       render()
//     }))
//   }

//   render()
// }

async function init() {
  const loader = new Loader();
  const controls = new Controls();
  const camera = new Camera(controls)
  const renderer = new Renderer(camera, loader, canvas);
  const engine = new Engine({ renderer, loader, controls });
  const ui = new UI({
    loader, camera, controls, renderer, engine
  });
  engine.setUI(ui);


  await engine.start();

}


init();