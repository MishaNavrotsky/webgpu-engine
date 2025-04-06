import Camera from "./lib/Camera";
import Controls from "./lib/Controls";
import Loader from "./lib/Loader";
import Engine from "./lib/Engine";
import Renderer from "./lib/Renderer";
import UI from "./ui";
import Scene from "./lib/Scene";

const canvas = document.getElementsByTagName('canvas')[0];
canvas.addEventListener('click', async () => {
  await canvas.requestPointerLock({
    unadjustedMovement: true,
  });
})

async function init() {
  const loader = new Loader();
  await loader.init();
  const controls = new Controls();
  const camera = new Camera(controls)
  const scene = new Scene();
  const renderer = new Renderer({ camera, loader, canvas });
  const engine = new Engine({ renderer, loader, controls, scene });
  const ui = new UI({
    loader, camera, controls, renderer, engine
  });
  engine.setUI(ui);


  await engine.start();
}


init();