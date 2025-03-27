import shaders from "@/shaders/main.wgsl?raw"
import { mat4, vec3 } from 'gl-matrix'
import Camera from "./lib/Camera";
import Controls from "./lib/Controls";
import Loader from "./lib/Loader";
import Mesh from "./lib/Mesh";

const canvas = document.getElementsByTagName('canvas')[0];
const resizeObserver = new ResizeObserver(() => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
resizeObserver.observe(canvas);
canvas.addEventListener('click', async () => {
  await canvas.requestPointerLock();
})

const controls = new Controls()
const loader = new Loader()


async function init() {
  await loader.load();

  if (!navigator.gpu) {
    throw Error("WebGPU not supported.");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw Error("Couldn't request WebGPU adapter.");
  }

  const device = await adapter.requestDevice();
  const shaderModule = device.createShaderModule({
    code: shaders,
  });

  const context = canvas.getContext('webgpu')!;

  context.configure({
    device: device,
    format: navigator.gpu.getPreferredCanvasFormat(),
    alphaMode: "premultiplied",
  });

  const model = loader.get('hand_low_poly')!;
  const mesh = new Mesh(model);

  const resolvedMesh = mesh.resolveMeshesToBytes();
  const vertices = resolvedMesh[0].primitives[0].attributes.POSITION;
  const indices = resolvedMesh[0].primitives[0].indices;

  const indicesBuffer = device.createBuffer({
    size: indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  })

  device.queue.writeBuffer(indicesBuffer, 0, indices);

  const vertexBuffer = device.createBuffer({
    size: vertices.byteLength, // make it big enough to store vertices in
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(vertexBuffer, 0, vertices, 0, vertices.length);

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
      module: shaderModule,
      entryPoint: "vertex_main",
      buffers: vertexBuffers,
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fragment_main",
      targets: [
        {
          format: navigator.gpu.getPreferredCanvasFormat(),
        },
      ],
    },
    primitive: {
      topology: "triangle-list",
    },
    multisample: {
      count: 1,
    },
    layout: "auto",
  };

  const renderPipeline = device.createRenderPipeline(pipelineDescriptor);

  const uniformBuffer = device.createBuffer({
    size: 2 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const cameraUniformBuffer = device.createBuffer({
    size: 4 * 4 * 3 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const bindGroup = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: cameraUniformBuffer } }
    ]
  })
  const unifromValues = new Float32Array(2);
  const cameraUniformValues = new Float32Array(4 * 4 * 3);
  const camera = new Camera(canvas.width, canvas.height, 90);
  const a = [0, 0]
  document.onmousemove = (e) => {
    unifromValues.set([e.clientX, e.clientY]);
    a[0] += e.movementX / 100;
    a[1] -= e.movementY / 100;

    if (a[1] > 1.55334) {
      a[1] = 1.55334
    }

    if (a[1] < -1.55334) {
      a[1] = -1.55334
    }

    const direction = new Float32Array([0, 0, 0])
    direction[0] = Math.cos(a[0]) * Math.cos(a[1]);
    direction[1] = Math.sin(a[1]);
    direction[2] = Math.sin(a[0]) * Math.cos(a[1]);
    vec3.normalize(direction, direction);
    camera.lookAt(direction)
  }

  const checkInputs = (dT: number) => {
    const p = camera.position;
    const l = camera.look;

    const speed = 0.02 * dT * (controls.has('shift') ? 2 : 1);

    if (controls.has('w')) {
      vec3.add(p, p, vec3.scale(l, l, speed))

    }

    if (controls.has('s')) {
      vec3.sub(p, p, vec3.scale(l, l, speed))

    }

    if (controls.has('a')) {
      const v = vec3.cross(l, l, [0, 1, 0]);
      const n = vec3.normalize(v, v);
      vec3.sub(p, p, vec3.scale(n, n, speed))
    }

    if (controls.has('d')) {
      const v = vec3.cross(l, l, [0, 1, 0]);
      const n = vec3.normalize(v, v);
      vec3.add(p, p, vec3.scale(n, n, speed))
    }

    camera.position = p;
  }

  const calculateCamera = () => {
    let model = mat4.create();

    cameraUniformValues.set([...model, ...camera.viewMatrix, ...camera.projectionMatrix])
  }

  const texture = device.createTexture({
    size: [canvas.width, canvas.height],
    sampleCount: 4,
    format: navigator.gpu.getPreferredCanvasFormat(),
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  let view = texture.createView();

  let startTime = 0;
  let endTime = 0;

  function render() {
    const dT = endTime - startTime;
    startTime = performance.now()
    checkInputs(dT);
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          loadOp: "clear",
          storeOp: "store",
          // resolveTarget: context.getCurrentTexture().createView(),
          view: context.getCurrentTexture().createView(),
        },
      ],
    };
    calculateCamera();

    device.queue.writeBuffer(uniformBuffer, 0, unifromValues);
    device.queue.writeBuffer(cameraUniformBuffer, 0, cameraUniformValues);


    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(renderPipeline);
    passEncoder.setVertexBuffer(0, vertexBuffer);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.setIndexBuffer(indicesBuffer, "uint32");
    passEncoder.drawIndexed(indices.length)
    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);

    device.queue.onSubmittedWorkDone().then(() => requestAnimationFrame(() => {
      endTime = performance.now()
      render()
    }))
  }

  render()
}


init();