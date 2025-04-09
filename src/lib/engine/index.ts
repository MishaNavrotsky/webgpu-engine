import UI from "@/lib/ui";
import Controls from "@/lib/camera/Controls";
import Loader from "@/lib/loader";
import Renderer from "@/lib/render";
import Scene from "@/lib/scene";
import GLBMesh from "../loader/GLBMesh";
import RenderableObject from "../render/renderable/RenderableObject";

export type EngineConstructor = {
  renderer: Renderer, loader: Loader, controls: Controls, ui?: UI, scene: Scene,
}

export default class Engine {
  private _renderer: Renderer;
  private _loader: Loader;
  private _controls: Controls;
  private _ui: UI | undefined;
  private _scene: Scene;
  constructor(settings: EngineConstructor) {
    this._renderer = settings.renderer;
    this._loader = settings.loader;
    this._controls = settings.controls;
    this._scene = settings.scene;
  }

  async prepareScene() {
    const mtyan = await new GLBMesh(await this._loader.getGLB('tyan')!);

    const mboxes = await new GLBMesh(await this._loader.getGLB('boxes')!);

    const mspaceship = await new GLBMesh(await this._loader.getGLB('spaceship')!);

    const mwall = await new GLBMesh(await this._loader.getGLB('wall')!);

    const maircraft = await new GLBMesh(await this._loader.getGLB('aircraft')!);


    const device = this._renderer.getDevice()

    const tyan = await RenderableObject.createFromGLB(mtyan, device, this._loader)
    const boxes = await RenderableObject.createFromGLB(mboxes, device, this._loader)
    const spaceship = await RenderableObject.createFromGLB(mspaceship, device, this._loader)
    const wall = await RenderableObject.createFromGLB(mwall, device, this._loader)
    const aircraft = await RenderableObject.createFromGLB(maircraft, device, this._loader)

    tyan.forEach(r => {
      r.scale([0.005, 0.005, 0.005]);
      r.translate([0, 0, 50]);
    })
    let s = 0;
    boxes.forEach(r => {
      s = s + 35;
      r.scale([0.2, 0.2, 0.2])
      r.translate([-130 + s, 1, 0])
    })
    spaceship.forEach(r => {
      r.scale([15, 15, 15]);
      r.rotateDeg([-90, 35, 0]);
      r.translate([-90, 20, 100]);
    })

    this._scene.addMesh(tyan);
    this._scene.addMesh(boxes);
    this._scene.addMesh(spaceship);
    this._scene.addMesh(wall);
  }

  async start() {
    this._controls.subscribe();
    await this._loader.loadShader('main', '/assets/shaders/main.wgsl');
    await this._loader.loadShader('zbuffer', '/assets/shaders/zbuffer.wgsl');

    await this._loader.loadShader('deferred/prepareBuffers', '/assets/shaders/deferred/prepareBuffers.wgsl');
    await this._loader.loadShader('deferred/main', '/assets/shaders/deferred/main.wgsl');

    await this._loader.loadGLB('tyan', '/assets/models/alicev2rigged.glb');
    await this._loader.loadGLB('hand', '/assets/models/hand_low_poly.glb');
    await this._loader.loadGLB('boxes', '/assets/models/furniture_decor_sculpture_8mb.glb');
    await this._loader.loadGLB('spaceship', '/assets/models/star_wars_galaxies_-_eta-2_actis_interceptor.glb');
    await this._loader.loadGLB('wall', '/assets/models/brick_wall.glb');
    await this._loader.loadGLB('aircraft', '/assets/models/su-33_flanker-d.glb');


    await this._renderer.initWebGpuCanvasContext();
    await this.prepareScene();
    await this._renderer.prepareMeshes(this._scene.scene);
    await this._renderer.initForwardRender();
    await this._renderer.initDeferredRender();

    const repeat = () => requestAnimationFrame(async () => { await this.mainLoop(); repeat() })
    repeat();
  }

  setUI(ui: UI) {
    this._ui = ui;
    ui.init();

    this._renderer.setUI(this._ui);
  }


  private startFrameTime = 0;
  private endFrameTime = 0;
  private dT = 0;
  private _gpuPipelineTimings = { cpu: 0, gpu: 0 }

  private async mainLoop() {
    this.startFrameTime = performance.now();

    await this._renderer.render(this.dT);
    this._gpuPipelineTimings = this._renderer.getTimings()

    this.endFrameTime = performance.now();

    this.dT = this.endFrameTime - this.startFrameTime;

    this._ui?.refresh()
  }

  getPerformance() {
    return {
      ...this._gpuPipelineTimings,
      dT: this.dT
    }

  }
}