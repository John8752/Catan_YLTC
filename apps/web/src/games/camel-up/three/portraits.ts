import * as THREE from "three";
import { makeCamel } from "./models.js";
import type { Camel } from "@catan/game-core/camel-up";
/** Render the same sculpted pieces for the DOM icon system, once per page. */
export function renderPortraits(): Record<Camel, string> {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); renderer.setSize(128, 128);
  renderer.setClearColor(0, 0); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 30); camera.position.set(1.6, 1.35, 3.6); camera.lookAt(.08, .7, 0);
  const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight("#fff8df", "#426b66", 2.5));
  const light = new THREE.DirectionalLight("#fff0d0", 2.4); light.position.set(-3, 5, 5); scene.add(light);
  const portraits = {} as Record<Camel, string>;
  for (const camel of ["blue", "green", "yellow", "red", "purple", "black", "white"] as const) {
    const model = makeCamel(camel); model.rotation.y = -.25; scene.add(model); renderer.render(scene, camera); portraits[camel] = renderer.domElement.toDataURL("image/png");
    model.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose(); } }); scene.remove(model);
  }
  renderer.dispose(); return portraits;
}
