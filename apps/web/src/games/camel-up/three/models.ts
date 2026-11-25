import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Camel } from "@catan/game-core/camel-up";
import { CAMEL_OUTLINE } from "../camel-silhouette.js";
import { CAMEL_COLORS } from "../palette.js";
const sphere = new THREE.SphereGeometry(1, 16, 12);
export function clay(color: THREE.ColorRepresentation, roughness = .64) { return new THREE.MeshStandardMaterial({ color, roughness, metalness: .03 }); }
export function solid(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], scale?: [number, number, number]) {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); if (scale) mesh.scale.set(...scale);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
export function roundBox(parent: THREE.Object3D, size: [number, number, number], material: THREE.Material, position: [number, number, number], radius = .12) {
  return solid(parent, new RoundedBoxGeometry(...size, 3, radius), material, position);
}
export function pebble(parent: THREE.Object3D, material: THREE.Material, position: [number, number, number], scale: [number, number, number]) { return solid(parent, sphere, material, position, scale); }
function tube(parent: THREE.Object3D, points: [number, number, number][], radius: number, material: THREE.Material) {
  return solid(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 14, radius, 8, false), material, [0, 0, 0]);
}
/** One-piece beveled wooden meeple, with no facial features or separate appendages. */
export function makeCamel(color: Camel) {
  const group = new THREE.Group(), material = clay(CAMEL_COLORS[color], .55);
  material.emissive.set(CAMEL_COLORS[color]); group.userData.fur = material;
  const outline = new THREE.Shape();
  for (const segment of CAMEL_OUTLINE) {
    switch (segment[0]) {
      case "M": outline.moveTo(segment[1], segment[2]); break;
      case "L": outline.lineTo(segment[1], segment[2]); break;
      case "Q": outline.quadraticCurveTo(segment[1], segment[2], segment[3], segment[4]); break;
      case "Z": outline.closePath(); break;
    }
  }
  const geometry = new THREE.ExtrudeGeometry(outline, { depth: .42, steps: 1, bevelEnabled: true, bevelSegments: 3, bevelSize: .055, bevelThickness: .055, curveSegments: 10 });
  geometry.translate(0, 0, -.21);
  solid(group, geometry, material, [0, 0, 0]);
  return group;
}
export function makePalm(parent: THREE.Object3D, x: number, z: number, size: number, turn: number) {
  const palm = new THREE.Group(); parent.add(palm); palm.position.set(x, .25, z); palm.scale.setScalar(size); palm.rotation.y = turn;
  tube(palm, [[0, 0, 0], [.1, 1, 0], [.3, 2, .05], [.2, 2.8, .1]], .115, clay("#997146"));
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI * 2 / 7, leaf = new THREE.Group(); leaf.position.set(.2, 2.75, .1); leaf.rotation.y = angle; palm.add(leaf);
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.quadraticCurveTo(.45, .7, 0, 1.9); shape.quadraticCurveTo(-.45, .7, 0, 0);
    const mesh = solid(leaf, new THREE.ExtrudeGeometry(shape, { depth: .025, bevelEnabled: false }), clay(i % 2 ? "#327d63" : "#1f6650"), [0, 0, 0]);
    mesh.rotation.x = -Math.PI / 2 + .28; mesh.rotation.z = .12;
    tube(leaf, [[0, 0, 0], [0, .1, -.7], [0, -.35, -1.8]], .022, clay("#73a86b"));
  }
}
export function makeDesert(parent: THREE.Object3D) {
  const sand = clay("#e4bd7e"), rim = clay("#b98148"), teal = clay("#185552"), gold = clay("#f2cc72", .3);
  roundBox(parent, [14.6, .8, 16.2], teal, [0, -.62, 0], .55);
  roundBox(parent, [14.35, .15, 15.95], gold, [0, -.18, 0], .42);
  roundBox(parent, [14.15, .32, 15.75], sand, [0, 0, 0], .4);
  const pyramid = new THREE.Group(); parent.add(pyramid);
  // Nine individually beveled stone courses, with a glazed teal course near the apex.
  for (let i = 0; i < 9; i++) {
    const bottom = (4.5 - i * .47) / Math.SQRT2, top = (4.5 - (i + 1) * .47) / Math.SQRT2;
    const mat = i === 7 ? teal : clay(["#d7a763", "#e6bd78", "#dbaf69"][i % 3]!);
    const course = solid(pyramid, new THREE.CylinderGeometry(Math.max(.02, top), bottom, .34, 4, 1), mat, [.3, .35 + i * .35, -.5]); course.rotation.y = Math.PI / 4;
  }
  const cap = solid(pyramid, new THREE.ConeGeometry(.34, .47, 4), gold, [.3, 3.62, -.5]); cap.rotation.y = Math.PI / 4;
  // Entrance and a small staircase, kept below the track's silhouette.
  roundBox(parent, [.7, 1.05, .18], clay("#554437"), [.3, .69, 1.66], .05);
  for (let i = 0; i < 4; i++) roundBox(parent, [1.12, .16, .42], rim, [.3, .16 + i * .13, 2.9 - i * .36], .04);
  pebble(parent, clay("#ba985a"), [-3.5, .2, -2.7], [1.9, .16, 1.7]);
  pebble(parent, clay("#258d85", .22), [-3.5, .26, -2.7], [1.6, .1, 1.4]);
  pebble(parent, clay("#50b2a2", .2), [-3.7, .28, -2.8], [1.05, .07, .9]);
  makePalm(parent, -4.1, -3.3, .9, .2); makePalm(parent, -2.5, -3.8, .72, 1.1); makePalm(parent, -4.5, -1.7, .66, 2.3);
  for (let i = 0; i < 18; i++) {
    const a = i * 2.399, x = Math.cos(a) * (i % 3 ? 6.6 : 2.6), z = Math.sin(a) * (i % 3 ? 7.15 : 2.4);
    if (Math.abs(x) < 2.5 && Math.abs(z) < 3.5) continue;
    const rock = solid(parent, new THREE.DodecahedronGeometry(.2 + (i % 3) * .12, 0), i % 2 ? sand : rim, [x, .3, z]); rock.scale.set(1.4, .8, 1); rock.rotation.set(i, i * .7, .1);
  }
  // A small desert camp in the open far corner.
  for (let i = 0; i < 2; i++) {
    const tent = solid(parent, new THREE.ConeGeometry(.95, .9, 3), clay(i ? "#c96942" : "#338275"), [3 + i * 1.6, .72, -3.8]); tent.rotation.y = Math.PI / 2;
    roundBox(parent, [.09, 1.2, .09], rim, [3 + i * 1.6, .8, -3.8], .03);
  }
  return pyramid;
}
