import Camera from "@/lib/camera";
import Controls from "@/lib/camera/Controls";
import { GlobalLoader } from "@/lib/loader";
import Engine from "@/lib/engine";
import Renderer from "@/lib/render";
import UI from "@/lib/ui";
import Scene from "./lib/scene";

const canvas = document.getElementsByTagName('canvas')[0];
canvas.addEventListener('click', async () => {
  await canvas.requestPointerLock({
    unadjustedMovement: true,
  });
})

async function init() {
  const loader = GlobalLoader;
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