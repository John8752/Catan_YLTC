import * as T from "three";
import { box, disc, mat, mesh } from "../../components/lobby/world-models.js";
export function makeLobbyModel(parent: T.Group) {
  disc(parent, 4.35, .2, "#b8acc5", 0, .3);
  const pages = new T.Group(); parent.add(pages); pages.rotation.y = -.22;
  for (let i = 0; i < 5; i++) { const page = box(pages, [4.25, .07, 3.3], i === 4 ? "#fff5dc" : ["#c57e7b", "#ead5bc", "#8faeb6"][i % 3]!, 0, .47 + i * .08, 0, .06); page.rotation.y = i * .035; }
  for (let i = 0; i < 5; i++) {
    const ring = mesh(pages, new T.TorusGeometry(.15, .035, 8, 18), mat("#bb9870"), -2.15, .78, -1 + i * .5); ring.rotation.x = Math.PI / 2;
  }
  // A deliberately playful original drawing, raised just above the paper.
  const paint = new T.Group(); pages.add(paint); paint.position.set(0, .84, -.1);
  disc(paint, .65, .025, "#e6b06d", 0, 0, 0, 48);
  disc(paint, .28, .025, "#e6b06d", -.5, .01, -.46, 32); disc(paint, .28, .025, "#e6b06d", .5, .01, -.46, 32);
  disc(paint, .09, .03, "#584c50", -.23, .025, -.1, 20); disc(paint, .09, .03, "#584c50", .23, .025, -.1, 20);
  disc(paint, .13, .03, "#d18a76", 0, .03, .2, 3);
  for (let i = 0; i < 3; i++) { const line = box(pages, [1 + .25 * i, .025, .045], "#a99bb8", -.5 + i * .15, .85, 1.05 + i * .16, .01); line.rotation.y = -.02; }
  const pencils = ["#dc9276", "#638e8a", "#d8b76a"];
  pencils.forEach((color, i) => {
    const p = new T.Group(); parent.add(p); p.position.set(2.6 + i * .3, .65, -.3 + i * .6); p.rotation.y = -.4 - i * .12;
    const shaft = mesh(p, new T.CylinderGeometry(.105, .105, 2.65, 6), mat(color)); shaft.rotation.x = Math.PI / 2;
    const tip = mesh(p, new T.ConeGeometry(.106, .35, 6), mat("#d4b48a"), 0, 0, 1.5); tip.rotation.x = Math.PI / 2;
  });
  const note = box(parent, [1.6, .08, 1.5], "#e2b8a3", -2.6, .55, 2.05); note.rotation.y = -.35;
  return pages;
}
