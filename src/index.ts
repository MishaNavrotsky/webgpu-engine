import shaders from "@/shaders/main.wgsl?raw"
import { glMatrix, mat4, vec3 } from 'gl-matrix'
import Camera from "./Camera";

const canvas = document.getElementsByTagName('canvas')[0];
const resizeObserver = new ResizeObserver(() => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
resizeObserver.observe(canvas);
canvas.addEventListener('click', async () => {
  await canvas.requestPointerLock();
})


async function init() {
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

  const vertices = new Float32Array([
    0, 1, 0, 1,
    0, 0, 1, 1, //c
    -1, -1, 0, 1,
    -0, 1, 0, 1, //c
    1, -1, 0, 1,
    1, 0, 0, 1, //c
  ]);


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
          format: "float32x4",
        },
        {
          shaderLocation: 1, // color
          offset: 16,
          format: "float32x4",
        },
      ],
      arrayStride: 32,
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

  document.onkeydown = (e) => {
    e.preventDefault();
    console.log(e.keyCode);
    const k = e.key.toLowerCase()
    const p = camera.position;
    const l = camera.look;

    const speed = 0.05

    switch (k) {
      case 'w': {
        vec3.add(p, p, vec3.scale(l, l, speed))
        break;
      }
      case 's': {
        vec3.sub(p, p, vec3.scale(l, l, speed))
        break;
      }
      case 'a': {
        const v = vec3.cross(l, l, [0, 1, 0]);
        const n = vec3.normalize(v, v);
        vec3.sub(p, p, vec3.scale(n, n, speed))

        break;
      }
      case 'd': {
        const v = vec3.cross(l, l, [0, 1, 0]);
        const n = vec3.normalize(v, v);
        vec3.add(p, p, vec3.scale(n, n, speed))

        break;

      }
      case ' ': {
        p[2] += speed;

        break;
      }
      case 'control': {
        p[2] -= speed;

        break;
      }

      case 'q': {
        l[2] -= speed;
        break;
      }

      case 'e': {
        l[2] += speed;

        break;
      }
    }

    // camera.lookAt(l);
    camera.position = p;
  }

  const calculateCamera = () => {
    let model = mat4.create();

    cameraUniformValues.set([...model, ...camera.viewMatrix, ...camera.projectionMatrix])
  }

  function render() {
    const tex = context.getCurrentTexture().createView();
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          loadOp: "clear",
          storeOp: "store",
          view: tex,
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
    passEncoder.draw(3);
    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);

    device.queue.onSubmittedWorkDone().then(() => requestAnimationFrame(() => render()))
  }

  render()
}


init();