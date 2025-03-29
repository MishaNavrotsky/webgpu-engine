import Controls from "./Controls";
import Loader from "./Loader";
import Renderer from "./Renderer";

export default class Engine {
  private _renderer: Renderer;
  private _loader: Loader;
  private _controls: Controls;
  constructor(renderer: Renderer, loader: Loader, controls: Controls) {
    this._renderer = renderer;
    this._loader = loader;
    this._controls = controls;
  }

  async start() {
    this._controls.subscribe();
    await this._loader.loadShader('shader', '/assets/shaders/main.wgsl');
    await this._loader.loadShader('defaultMaterial', '/assets/shaders/defaultMaterial.wgsl');
    await this._loader.loadGLB('tyan', '/assets/models/alicev2rigged.glb');
    await this._renderer.initWebGpuCanvasContext();

    const repeat = () => requestAnimationFrame(async () => { await this.mainLoop(); repeat() })
    repeat();
  }


  private startFrameTime = 0;
  private endFrameTime = 0;
  private dT = 0;

  private async mainLoop() {
    this.startFrameTime = performance.now();

    await this._renderer.render(this.dT);
    this._controls.clearDeltaMouse();

    this.endFrameTime = performance.now();

    this.dT = this.endFrameTime - this.startFrameTime;
  }

}