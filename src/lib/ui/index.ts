import { BindingParams, FolderApi, Pane } from 'tweakpane'
import Camera from "@/lib/camera";
import Controls from "@/lib/camera/Controls";
import Loader from "@/lib/loader";
import Renderer from "@/lib/render";
import { vec3toXYZ, XYZtoVec3, XYZWtoVec4 } from '@/utils/vec3utils';
import Engine from '@/lib/engine';

export type UIConstructor = {
  loader: Loader,
  controls: Controls,
  renderer: Renderer,
  camera: Camera,
  engine: Engine,
}

export default class UI {
  private _pane: Pane | undefined;
  private _frameFolder: FolderApi | undefined;
  private _cameraFolder: FolderApi | undefined;
  private _lightFolder: FolderApi | undefined;
  private _deferredSettingsFolder: FolderApi | undefined;
  private _settings: UIConstructor;
  private _cameraControls = {
    width: 0,
    height: 0,
    fov: 0,
    look: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: 0, z: 0 },
  }

  private _cameraControlsSettings: { [key: string]: BindingParams } = {
    width: { readonly: true, interval: 0 },
    height: { readonly: true, interval: 0 },
    fov: {
      interval: 0,
    },
    look: { interval: 0 },
    position: { interval: 0 },
  }


  private _frameInfo = {
    fps: 0,
    gpu_time: 0,
    cpu_time: 0,
  }

  private _lightInfo = {
    position: { x: 0, y: 28, z: 161, w: 0 },
    color: { x: 1, y: 1, z: 1, w: 0 },
    intensityRadiusZZ: { x: 0.5, y: 1000, z: 0, w: 0 },
  }

  private _deferredSettings = 0;
  constructor(settings: UIConstructor) {
    this._settings = settings;
  }

  init() {
    this._pane = new Pane();

    this._frameFolder = this._pane.addFolder({
      title: 'Frame',
    })

    Object.entries(this._frameInfo).forEach(([k]) => {
      this._frameFolder?.addBinding(this._frameInfo, k as any, {
        readonly: true,
        view: 'graph',
        interval: 200,
        min: -10,
        max: k === 'fps' ? 300 : 40,
        rows: 1,
      })
    })


    this._cameraFolder = this._pane.addFolder({
      title: 'Camera'
    })


    Object.entries(this._cameraControls).forEach(([k]) => {
      this._cameraFolder?.addBinding(this._cameraControls, k as any, this._cameraControlsSettings[k])
    })

    this._lightFolder = this._pane.addFolder({
      title: 'Light'
    })


    Object.entries(this._lightInfo).forEach(([k]) => {
      this._lightFolder?.addBinding(this._lightInfo, k as any)
    })

    this._deferredSettingsFolder = this._pane.addFolder({
      title: 'Deferred'
    })

    console.log(999)


    this._deferredSettingsFolder.on('change', (v) => this._deferredSettings = v.value as number)
  }

  get lightsInfo() {
    return {
      position: XYZWtoVec4(this._lightInfo.position),
      color: XYZWtoVec4(this._lightInfo.color),
      intensityRadiusZZ: XYZWtoVec4(this._lightInfo.intensityRadiusZZ),
    };
  }

  get deferredSettings() {
    return this._deferredSettings;
  }

  private refreshCamera() {
    this._cameraControls.fov = this._settings.camera.fov;
    this._cameraControls.look = vec3toXYZ(this._settings.camera.look);
    this._cameraControls.position = vec3toXYZ(this._settings.camera.position);
    this._cameraControls.height = this._settings.camera.height;
    this._cameraControls.width = this._settings.camera.width;
  }

  private refreshPerformance() {
    const perf = this._settings.engine.getPerformance();
    this._frameInfo.cpu_time = perf.dT - perf.gpu;
    this._frameInfo.gpu_time = perf.gpu;
    this._frameInfo.fps = 1000 / (perf.dT | 1);
  }

  refresh() {
    if (!this._pane) return;

    this.refreshPerformance()
    this.refreshCamera()

    this._cameraFolder?.refresh()
  }

  private syncCamera() {
    this._settings.camera.fov = this._cameraControls.fov
    this._settings.camera.lookAt(XYZtoVec3(this._cameraControls.look))
    this._settings.camera.position = XYZtoVec3(this._cameraControls.position)
  }

  sync() {
    this.syncCamera()
  }
}