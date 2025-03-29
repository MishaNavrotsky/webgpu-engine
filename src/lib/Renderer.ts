import Camera from "./Camera";
import Loader from "./Loader";
import Mesh from "./Mesh";

document.getElementsByTagName('canvas')[0]

export default class Renderer {
  private _meshes: Array<Mesh> = [];
  private _camera: Camera;
  private _loader: Loader;
  private _fov: number = 90;
  constructor(camera: Camera, loader: Loader, canvas: HTMLCanvasElement) {
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

  render(dT: number) {
    const mPV = this._camera.calculate(dT);
  }

  async initWebGpuCanvasContext() {
    if (!navigator.gpu) {
      throw Error("WebGPU not supported.");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw Error("Couldn't request WebGPU adapter.");
    }

    const device = await adapter.requestDevice();
    const shaderModule = device.createShaderModule({
      code: this._loader.getShader('shader')!,
      label: 'shader'
    });

    console.log(shaderModule)
  }

}