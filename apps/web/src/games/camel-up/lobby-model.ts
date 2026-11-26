import * as T from "three";
import { box, disc, tree, die, mat, mesh } from "../../components/lobby/world-models.js";
import { CAMEL_OUTLINE } from "./camel-silhouette.js";
function camel(parent: T.Object3D, color: string, x: number, y: number, z: number) {
  const outline = new T.Shape();
  for (const s of CAMEL_OUTLINE) {
    switch (s[0]) {
      case "M": outline.moveTo(s[1], s[2]); break;
      case "L": outline.lineTo(s[1], s[2]); break;
      case "Q": outline.quadraticCurveTo(s[1], s[2], s[3], s[4]); break;
      case "Z": outline.closePath(); break;
    }
  }
  return mesh(parent, new T.ExtrudeGeometry(outline, { depth: .35, bevelEnabled: true, bevelSize: .055, bevelThickness: .055, bevelSegments: 2, steps: 1, curveSegments: 8 }), mat(color), x, y, z);
}
export function makeLobbyModel(parent: T.Group) {
  disc(parent, 4.35, .22, "#d5b47e", 0, .3);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const t = box(parent, [1.03, .13, 1.05], i % 2 ? "#efdbb1" : "#f8e6c1", Math.cos(a) * 3.05, .49, Math.sin(a) * 3.05); t.rotation.y = -a; }
  for (let i = 0; i < 7; i++) { const size = 2.75 - i * .34; const tier = mesh(parent, new T.CylinderGeometry((size - .3) / 1.414, size / 1.414, .3, 4), mat(i % 2 ? "#ddba7e" : "#eacb93"), .1, .65 + i * .3, -.6); tier.rotation.y = Math.PI / 4; }
  box(parent, [.45, .68, .06], "#79603e", .1, .8, .8);
  const moving = new T.Group(); parent.add(moving);
  camel(moving, "#428f84", -1.5, .62, 2.5); camel(moving, "#e2ad48", -1.5, 1.7, 2.5); camel(parent, "#cc785d", 1.1, .6, 2.7); camel(parent, "#6492b6", -2.8, .6, .3);
  tree(parent, 2.1, -1.5, 1.1); tree(parent, 2.5, -.8, .7);
  die(parent, -3.1, -1.6, "#e6b657", -.3);
  return moving;
}
