import * as T from "three";
import type { GameType } from "@catan/protocol/platform";
import { box, mat, mesh, release } from "./world-models.js";
import { buildModel } from "../../lobby-art.js";

interface State { gameId: GameType; seated: number; capacity: number }
export function createWorld(container: HTMLElement, initial: State, onFailure: () => void) {
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  const canvas = renderer.domElement; canvas.className = "h-full w-full"; canvas.setAttribute("aria-hidden", "true"); container.append(canvas);
  const scene = new T.Scene(), camera = new T.OrthographicCamera(-7, 7, 6, -6, .1, 100);
  camera.position.set(10, 12, 15); camera.lookAt(0, .25, 0);
  scene.add(new T.HemisphereLight("#fff3d6", "#668c89", 2.5));
  const light = new T.DirectionalLight("#ffe3ae", 4.3); light.position.set(-6, 12, 7); light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024); Object.assign(light.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: .1, far: 35 });
  light.shadow.normalBias = .04; light.shadow.bias = -.0003; scene.add(light);
  scene.add(new T.AmbientLight("#c6ddd4", .6));
  const base = new T.Group(); scene.add(base);
  mesh(base, new T.CylinderGeometry(4.65, 4.48, .36, 96), mat("#a87a51"), 0, 0, 0);
  mesh(base, new T.CylinderGeometry(4.56, 4.65, .1, 96), mat("#ddbf8b"), 0, .22, 0);
  const shadow = mesh(scene, new T.PlaneGeometry(200, 200), new T.ShadowMaterial({ opacity: .19 }), 0, -.8, 0); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false;
  const chairs = new T.Group(); scene.add(chairs);
  let state = initial, model = buildModel(initial.gameId, initial.capacity > 0); scene.add(model.world);
  let raf = 0, disposed = false, visible = true, enterAt = performance.now(), lastAt = 0, pointerX = 0, pointerY = 0;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  function seats() {
    release(chairs); chairs.clear();
    for (let i = 0; i < state.capacity; i++) {
      const a = Math.PI * 2 * i / state.capacity, chair = new T.Group(); chairs.add(chair); chair.position.set(Math.sin(a) * 5.45, -.35, Math.cos(a) * 5.45); chair.rotation.y = a;
      const occupied = i < state.seated, color = occupied ? "#c8aa78" : "#657d70";
      box(chair, [.8, .14, .7], color); box(chair, [.8, .55, .12], color, 0, .26, .32);
      for (const x of [-.27, .27]) box(chair, [.09, .45, .09], "#8e7152", x, -.28, .17, .02);
      if (occupied) { mesh(chair, new T.SphereGeometry(.19, 16, 12), mat("#e7cc9b"), 0, .85, 0); mesh(chair, new T.ConeGeometry(.26, .5, 12), mat("#dfc393"), 0, .46, 0); }
    }
  }
  seats();
  function render(now = performance.now(), force = false) {
    raf = 0;
    if (disposed || (!force && (!visible || document.hidden))) return;
    if (!force && now - lastAt < 32 && !reduced.matches) { raf = requestAnimationFrame(render); return; }
    lastAt = now;
    const progress = reduced.matches ? 1 : Math.min(1, (now - enterAt) / 800), ease = 1 - Math.pow(1 - progress, 4);
    model.world.position.y = (1 - ease) * -.6; model.world.rotation.y = (1 - ease) * -.24 + pointerX * .045;
    model.world.scale.setScalar(.93 + ease * .07);
    base.rotation.y = pointerX * .015; camera.position.y = 12 + pointerY * .3; camera.lookAt(0, .25, 0);
    if (!reduced.matches) {
      const wave = Math.sin(now / 1800);
      if (state.gameId === "catan") model.detail.position.y = .48 + wave * .035;
      else if (state.gameId === "draw-guess") model.detail.rotation.y = -.22 + (1 - ease) * .16;
      else if (state.gameId === "camel-up") model.detail.position.x = (1 - ease) * -.8;
      else if (state.gameId === "carcassonne") model.detail.position.y = .8 + (1 - ease) * 1.3;
      else if (state.gameId === "texas-holdem") model.detail.rotation.y = .15 + (1 - ease) * .5;
    }
    renderer.render(scene, camera);
    canvas.dataset.worldFrame = state.gameId; canvas.dataset.worldSettled = String(progress >= 1);
    // A single entrance, then render on demand; an idle lobby must not drain phones.
    if (!reduced.matches && progress < 1 && visible && !document.hidden) raf = requestAnimationFrame(render);
  }
  function wake() { if (!disposed && !raf) raf = requestAnimationFrame(render); }
  function resize() {
    const { width, height } = container.getBoundingClientRect(); if (!width || !height) return;
    renderer.setSize(width, height, false); const aspect = width / height, span = state.capacity ? 5.6 : 3.85;
    camera.left = -span * Math.max(1, aspect); camera.right = -camera.left; camera.top = span / Math.min(1, aspect); camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    // Resizing clears a WebGL drawing buffer. Draw in this ResizeObserver turn,
    // before the browser can paint or capture an empty canvas at the new size.
    if (raf) cancelAnimationFrame(raf);
    render(performance.now(), true);
  }
  const observer = new ResizeObserver(resize); observer.observe(container);
  const intersection = new IntersectionObserver(([entry]) => { visible = Boolean(entry?.isIntersecting); if (visible) wake(); else if (raf) { cancelAnimationFrame(raf); raf = 0; } }); intersection.observe(container);
  function pointer(e: PointerEvent) { if (e.pointerType !== "mouse" || reduced.matches) return; const r = container.getBoundingClientRect(); pointerX = (e.clientX - r.left) / r.width - .5; pointerY = (e.clientY - r.top) / r.height - .5; wake(); }
  function resetPointer() { pointerX = pointerY = 0; wake(); }
  function lost(e: Event) { e.preventDefault(); if (raf) cancelAnimationFrame(raf); raf = 0; onFailure(); }
  container.addEventListener("pointermove", pointer); container.addEventListener("pointerleave", resetPointer); canvas.addEventListener("webglcontextlost", lost);
  document.addEventListener("visibilitychange", wake); reduced.addEventListener("change", wake); resize();
  return {
    update(gameId: GameType, seated: number, capacity: number) {
      if (state.gameId !== gameId) { scene.remove(model.world); release(model.world); model = buildModel(gameId, capacity > 0); scene.add(model.world); enterAt = performance.now(); }
      const changedSeats = state.seated !== seated || state.capacity !== capacity;
      state = { gameId, seated, capacity }; if (changedSeats) seats(); resize(); wake();
    },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); observer.disconnect(); intersection.disconnect();
      container.removeEventListener("pointermove", pointer); container.removeEventListener("pointerleave", resetPointer); canvas.removeEventListener("webglcontextlost", lost);
      document.removeEventListener("visibilitychange", wake); reduced.removeEventListener("change", wake); release(scene); renderer.dispose(); canvas.remove();
    },
  };
}
