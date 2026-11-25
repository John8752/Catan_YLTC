import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Camel } from "@catan/game-core/camel-up";
import type { CamelGameView } from "@catan/protocol/camel-up";
import { CAMEL_STACK_STEP } from "../camel-silhouette.js";
import { CAMEL_COLORS } from "../palette.js";
import { clay, makeCamel, makeDesert, roundBox, solid } from "./models.js";
export interface ArenaState { game: CamelGameView | null; effect: CamelGameView["effect"]; tileSpaces: readonly number[]; onSpace: ((space: number) => void) | undefined }
export interface ArenaController { update: (state: ArenaState) => void; reset: () => void; zoom: (factor: number) => void; dispose: () => void }
const defaultStacks: Record<number, Camel[]> = { 1: ["blue", "green"], 2: ["red"], 3: ["yellow", "purple"], 15: ["white"], 16: ["black"] };
/** Geometry only: track locations never participate in legality or game state. */
const track = Array.from({ length: 16 }, (_, i) => {
  const angle = 2.25 - i * Math.PI / 8;
  return { x: Math.cos(angle) * 5.48, z: Math.sin(angle) * 6.25, angle };
});
function numberMaterial(text: string, foreground: string, background?: string) {
  const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 128;
  const context = canvas.getContext("2d")!;
  if (background) { context.fillStyle = background; context.fillRect(0, 0, 128, 128); }
  context.fillStyle = foreground; context.font = "700 77px 'Noto Sans SC Variable', sans-serif"; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(text, 64, 70);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture, transparent: !background, depthWrite: false, side: THREE.DoubleSide });
}
export function createArena(container: HTMLDivElement, initial: ArenaState, onFailure: () => void): ArenaController {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8)); renderer.setClearColor(0, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.domElement.setAttribute("aria-label", "可旋转的立体沙漠赛场，拖动旋转，双指缩放"); renderer.domElement.setAttribute("role", "img");
  renderer.domElement.className = "absolute inset-0 h-full w-full touch-none"; container.append(renderer.domElement);
  const scene = new THREE.Scene(), world = new THREE.Group(); scene.add(world);
  const camera = new THREE.OrthographicCamera(-11, 11, 11, -11, .1, 150);
  camera.position.set(8, 27, 17); camera.lookAt(0, .7, 0);
  const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, .7, 0); controls.enablePan = false;
  controls.minPolarAngle = .32; controls.maxPolarAngle = 1.04; controls.minZoom = .75; controls.maxZoom = 2.1; controls.rotateSpeed = .65;
  controls.update(); controls.saveState();
  scene.add(new THREE.HemisphereLight("#fff4dc", "#436d6b", 2.1));
  const light = new THREE.DirectionalLight("#ffe3ad", 3.2); light.position.set(-7, 17, 10); light.castShadow = true;
  light.shadow.mapSize.set(1536, 1536); Object.assign(light.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 45 }); light.shadow.normalBias = .035; light.shadow.bias = -.00025; light.shadow.radius = 3;
  scene.add(light); scene.add(new THREE.AmbientLight("#c6e5df", .45));
  const ground = solid(scene, new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: .22 }), [0, -1.1, 0]); ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
  const pyramid = makeDesert(world);
  const tiles: THREE.Mesh[] = [], tileMaterials: THREE.MeshStandardMaterial[] = [];
  for (const [index, pos] of track.entries()) {
    const material = clay(index % 2 ? "#f2dca4" : "#f8e6bb", .56); tileMaterials.push(material);
    const tile = roundBox(world, [1.87, .22, 1.92], material, [pos.x, .3, pos.z], .13); tile.rotation.y = -pos.angle; tile.userData.space = index + 1; tiles.push(tile);
    const label = solid(world, new THREE.PlaneGeometry(.9, .9), numberMaterial(String(index + 1), "#886330"), [pos.x + Math.cos(pos.angle) * .6, .422, pos.z + Math.sin(pos.angle) * .6]); label.rotation.x = -Math.PI / 2; label.castShadow = false;
  }
  // Finish gate on the boundary from 16 to 1, deliberately offset from the camels.
  const gate = new THREE.Group(); world.add(gate); const a = track[0]!, b = track[15]!; gate.position.set((a.x + b.x) / 2, .3, (a.z + b.z) / 2); gate.rotation.y = -a.angle;
  for (const z of [-1, 1]) roundBox(gate, [.07, 2.35, .07], clay("#84683f"), [0, 1.1, z], .025);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) roundBox(gate, [.04, .19, .25], clay((i + j) % 2 ? "#214d47" : "#f8e9bd"), [0, 2.08 + j * .19, -.875 + i * .25], .01);
  const camels = new Map<Camel, THREE.Group>();
  for (const camel of ["blue", "green", "yellow", "red", "purple", "black", "white"] as const) { const model = makeCamel(camel); world.add(model); camels.set(camel, model); }
  const spectators = new THREE.Group(); world.add(spectators);
  let state = initial, frame = 0, disposed = false, moving = false, first = true, actionAt = -10_000, effectRevision = -1, stackPadding = 0;
  let targets = new Map<Camel, { position: THREE.Vector3; from: THREE.Vector3; rotation: number; at: number }>();
  const die = new THREE.Group(); world.add(die); die.visible = false;
  const dieMaterial = clay("#e8bd64", .3);
  roundBox(die, [.85, .85, .85], dieMaterial, [0, 0, 0], .13);
  const pips = new THREE.Group(); die.add(pips);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  function draw() { if (!disposed) renderer.render(scene, camera); }
  function animate() {
    if (disposed) return;
    let remains = false;
    const now = performance.now(), elapsed = now - actionAt;
    for (const [camel, target] of targets) {
      const model = camels.get(camel)!;
      const progress = reduced.matches ? 1 : Math.min(1, (now - target.at) / 720), ease = 1 - Math.pow(1 - progress, 3);
      model.position.lerpVectors(target.from, target.position, ease);
      if (progress < 1 && target.from.distanceTo(target.position) > .01) { model.position.y += .48 * Math.sin(progress * Math.PI); remains = true; }
      model.scale.setScalar(1 + (progress > .8 && progress < 1 ? .045 * Math.sin((progress - .8) * Math.PI * 5) : 0));
      const emphasized = state.effect?.camel === camel && elapsed < 1800;
      const fur = model.userData.fur as THREE.MeshStandardMaterial;
      fur.emissiveIntensity = emphasized ? (reduced.matches ? .15 : .13 + .13 * Math.sin(elapsed / 160)) : 0;
      if (emphasized && !reduced.matches) remains = true;
    }
    for (const child of spectators.children) {
      const landed = child.userData.landedAt as number | undefined;
      if (landed !== undefined) {
        const t = reduced.matches ? 1 : Math.min(1, (now - landed) / 420);
        child.position.y = (1 - t) * .8; child.scale.setScalar(.85 + .15 * t);
        if (t < 1) remains = true;
      }
    }
    if (elapsed < 1800 && state.effect?.type === "roll") {
      remains = !reduced.matches;
      pyramid.rotation.z = reduced.matches || elapsed > 500 ? 0 : Math.sin(elapsed * .05) * .035 * (1 - elapsed / 500);
      die.visible = elapsed > 200 && elapsed < 1700;
      const t = Math.min(1, Math.max(0, (elapsed - 200) / 650));
      die.position.set(-1.2, 2.2 + Math.sin(t * Math.PI) * 1.7, 2.5);
      die.rotation.set(reduced.matches ? .3 : (1 - t) * Math.PI * 4 + .3, reduced.matches ? .5 : (1 - t) * Math.PI * 3 + .5, .15);
      die.scale.setScalar(elapsed > 1450 ? Math.max(.01, (1700 - elapsed) / 250) : 1);
    } else { die.visible = false; pyramid.rotation.z = 0; }
    draw(); if (remains) frame = requestAnimationFrame(animate); else moving = false;
  }
  function disposeObject(root: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    root.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material); } });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) { const textured = material as THREE.MeshBasicMaterial; textured.map?.dispose(); material.dispose(); }
  }
  function update(next: ArenaState) {
    const changed = next.game?.revision !== state.game?.revision || first;
    state = next;
    const tallest = Math.max(1, ...Object.values(state.game?.stacks ?? defaultStacks).map(stack => stack.length));
    const padding = Math.max(0, tallest - 3) * 1.1;
    if (padding !== stackPadding) { stackPadding = padding; resize(); }
    container.dataset.stackDepth = String(tallest);
    if (changed) targets = new Map();
    for (const [rawSpace, stack] of Object.entries(state.game?.stacks ?? defaultStacks)) {
      const pos = track[Math.max(0, Math.min(15, Number(rawSpace) - 1))]!;
      stack.forEach((camel, layer) => {
        const model = camels.get(camel)!;
        // Feet rest on the previous camel’s broad hump, rather than floating.
        const position = new THREE.Vector3(pos.x, .44 + layer * CAMEL_STACK_STEP, pos.z);
        const rotation = Math.atan2(Math.cos(pos.angle) * 6.25, Math.sin(pos.angle) * 5.48) + (camel === "black" || camel === "white" ? Math.PI : 0);
        if (changed) targets.set(camel, { position, from: first || reduced.matches ? position.clone() : model.position.clone(), rotation, at: performance.now() }); model.rotation.y = rotation;
        if (first || reduced.matches) model.position.copy(position);
      });
    }
    if (state.effect && state.effect.revision !== effectRevision) {
      effectRevision = state.effect.revision; actionAt = performance.now();
      if (state.effect.type === "roll") {
        disposeObject(pips); pips.clear();
        dieMaterial.color.set(state.game?.lastRoll?.die === "grey" ? "#73857b" : state.effect.camel ? CAMEL_COLORS[state.effect.camel] : "#e8bd64");
        const count = state.effect.value ?? 1;
        for (let i = 0; i < count; i++) {
          const offset = (i - (count - 1) / 2) * .19;
          solid(pips, new THREE.SphereGeometry(.065, 10, 8), clay("#fff5d9"), [offset, offset, .421], [1, 1, .2]);
          solid(pips, new THREE.SphereGeometry(.065, 10, 8), clay("#fff5d9"), [offset, .421, offset], [1, .2, 1]);
        }
      }
    }
    for (const [index, material] of tileMaterials.entries()) material.color.set(state.tileSpaces.includes(index + 1) ? "#8bca99" : index % 2 ? "#f2dca4" : "#f8e6bb");
    if (changed) { disposeObject(spectators); spectators.clear();
    for (const tile of state.game?.tiles ?? []) {
      const pos = track[tile.space - 1]!;
      const placed = new THREE.Group(); spectators.add(placed);
      if (!first && state.effect?.type === "tile" && state.effect.space === tile.space) placed.userData.landedAt = performance.now();
      const plaque = roundBox(placed, [1.05, .12, 1.05], clay(tile.side === "cheer" ? "#22785a" : "#c15c3e"), [pos.x, .51, pos.z], .12); plaque.rotation.y = -pos.angle;
      const symbol = solid(placed, new THREE.PlaneGeometry(.7, .7), numberMaterial(tile.side === "cheer" ? "+1" : "−1", "#fff6d7"), [pos.x, .58, pos.z]); symbol.rotation.x = -Math.PI / 2;
    } }
    first = false;
    if (!moving) { moving = true; frame = requestAnimationFrame(animate); }
  }
  function resize() {
    if (disposed) return; const width = container.clientWidth, height = container.clientHeight; if (!width || !height) return;
    const aspect = width / height, halfWidth = aspect < 1 ? 10.9 + stackPadding : (10.2 + stackPadding) * aspect;
    camera.left = -halfWidth; camera.right = halfWidth; camera.top = halfWidth / aspect; camera.bottom = -halfWidth / aspect; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); draw();
  }
  const observer = new ResizeObserver(resize); observer.observe(container); controls.addEventListener("change", draw);
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(); let down = { x: 0, y: 0 };
  function pointerDown(event: PointerEvent) { down = { x: event.clientX, y: event.clientY }; }
  function pointerUp(event: PointerEvent) {
    if (!state.onSpace || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 8) return;
    const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(tiles)[0]; const space = hit?.object.userData.space as number | undefined;
    if (space && state.tileSpaces.includes(space)) state.onSpace(space);
  }
  function contextLost(event: Event) { event.preventDefault(); onFailure(); }
  renderer.domElement.addEventListener("pointerdown", pointerDown); renderer.domElement.addEventListener("pointerup", pointerUp); renderer.domElement.addEventListener("webglcontextlost", contextLost);
  resize(); update(initial); draw(); container.dataset.renderer = "three";
  return { update, reset() { controls.reset(); draw(); }, zoom(factor) { camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, .75, 2.1); camera.updateProjectionMatrix(); draw(); },
    dispose() { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.removeEventListener("change", draw); controls.dispose(); renderer.domElement.removeEventListener("pointerdown", pointerDown); renderer.domElement.removeEventListener("pointerup", pointerUp); renderer.domElement.removeEventListener("webglcontextlost", contextLost); disposeObject(scene); renderer.dispose(); renderer.domElement.remove(); } };
}
