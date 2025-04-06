import UI from "@/ui";
import Controls from "./Controls";
import Loader from "./Loader";
import Renderer from "./Renderer";
import Scene from "./Scene";
import GLBMesh from "./GLBMesh";
import Mesh from "./Mesh";

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
    const mtyan = await new GLBMesh(await this._loader.getGLB('tyan')!).resolveMeshesToBytes()
    const tyan = mtyan.map((m, i) => {
      const primitive = m.primitives[0]
      const t = new Mesh({
        id: m.name,
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
      t.scale = [0.005, 0.005, 0.005]
      t.translation = [0, 0, 50];

      return t;
    })

    const mboxes = await new GLBMesh(await this._loader.getGLB('boxes')!).resolveMeshesToBytes()
    let s = 0;
    const boxes = mboxes.map((m, i) => {
      const primitive = m.primitives[0]
      const t = new Mesh({
        id: m.name,
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

      s = s + 35;
      t.translation = [-130 + s, 1, 0]
      t.scale = [0.2, 0.2, 0.2]

      return t;
    })

    const mspaceship = await new GLBMesh(await this._loader.getGLB('spaceship')!).resolveMeshesToBytes()
    const spaceship = mspaceship.map((m, i) => {
      const primitive = m.primitives[0]
      const t = new Mesh({
        id: m.name,
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

      t.scale = [15, 15, 15];
      t.rotation = [-90, 35, 0];
      t.translation = [-90, 20, 100];

      // s = s + 100;
      // t.translation = [s, 0, 0]

      return t;
    })

    const mwall = await new GLBMesh(await this._loader.getGLB('wall')!).resolveMeshesToBytes()
    const wall = mwall.map((m, i) => {
      const primitive = m.primitives[0]
      const t = new Mesh({
        id: m.name,
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

      t.scale = [1, 1, 1];

      // s = s + 100;
      // t.translation = [s, 0, 0]

      return t;
    })



    this._scene.addMesh(boxes);
    this._scene.addMesh(wall);
    this._scene.addMesh(spaceship);
    this._scene.addMesh(tyan);


  }

  async start() {
    this._controls.subscribe();
    await this._loader.loadShader('main', '/assets/shaders/main.wgsl');

    await this._loader.loadShader('deferred/prepareBuffers', '/assets/shaders/deferred/prepareBuffers.wgsl');
    await this._loader.loadShader('deferred/main', '/assets/shaders/deferred/main.wgsl');

    await this._loader.loadGLB('tyan', '/assets/models/alicev2rigged.glb');
    await this._loader.loadGLB('hand', '/assets/models/hand_low_poly.glb');
    await this._loader.loadGLB('boxes', '/assets/models/furniture_decor_sculpture_8mb.glb');
    await this._loader.loadGLB('spaceship', '/assets/models/star_wars_galaxies_-_eta-2_actis_interceptor.glb');
    await this._loader.loadGLB('wall', '/assets/models/brick_wall.glb');


    await this.prepareScene();

    await this._renderer.initWebGpuCanvasContext();
    await this._renderer.prepareMeshes(this._scene.meshes);
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