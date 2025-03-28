import Controls from "./Controls";
import Loader from "./Loader";
import Renderer from "./Renderer";

export default class Engine {
  private renderer: Renderer;
  private loader: Loader;
  private controls: Controls;
  constructor(renderer: Renderer, loader: Loader, controls: Controls) {
    this.renderer = renderer;
    this.loader = loader;
    this.controls = controls;
  }

  async start() {
    await this.loader.load();
    this.controls.subscribe();

    const repeat = () => requestAnimationFrame(() => { this.mainLoop(); repeat() })
    repeat();
  }


  private startFrameTime = 0;
  private endFrameTime = 0;
  private dT = 0;

  private mainLoop() {
    this.startFrameTime = performance.now();

    this.renderer.render(this.dT);
    this.controls.clearDeltaMouse();

    this.endFrameTime = performance.now();

    this.dT = this.endFrameTime - this.startFrameTime;
  }

}