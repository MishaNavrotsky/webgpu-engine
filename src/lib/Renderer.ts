import Camera from "./Camera";
import Mesh from "./Mesh";

document.getElementsByTagName('canvas')[0]

export default class Renderer {
  private meshes: Array<Mesh> = [];
  private camera: Camera;
  private _fov: number = 90;
  constructor(camera: Camera, canvas: HTMLCanvasElement) {
    this.camera = camera;
    this.camera.init(canvas.width, canvas.height, this._fov);

    const resizeObserver = new ResizeObserver(() => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      this.camera.setPerspective(canvas.width, canvas.height, camera.fov)
    });
    resizeObserver.observe(canvas);
  }

  render(dT: number) {
    this.camera.calculate(dT);
  }

}