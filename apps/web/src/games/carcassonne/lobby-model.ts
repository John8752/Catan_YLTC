import * as T from "three";
import { box, disc, tree, house, mat, mesh } from "../../components/lobby/world-models.js";
export function makeLobbyModel(parent: T.Group) {
  disc(parent, 4.35, .2, "#708e6b", 0, .3);
  const tiles = new T.Group(); parent.add(tiles); tiles.rotation.y = -.15;
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
    const px = x * 1.77, pz = z * 1.77;
    box(tiles, [1.72, .18, 1.72], (x + z) % 2 ? "#9caf79" : "#b6c18a", px, .51, pz);
    if (x === 0) box(tiles, [.25, .035, 1.73], "#e3c997", px, .62, pz, .02);
    if (z === 0 && x !== 0) {
      box(tiles, [1.6, .6, .24], "#c7b48b", px, .85, pz);
      for (let i = 0; i < 5; i++) box(tiles, [.15, .17, .27], "#ded1aa", px - .65 + i * .32, 1.23, pz, .015);
      for (const d of [-.63, .63]) { box(tiles, [.4, .9, .4], "#cbb991", px + d, .99, pz); const roof = mesh(tiles, new T.ConeGeometry(.35, .5, 4), mat("#a66c4d"), px + d, 1.66, pz); roof.rotation.y = Math.PI / 4; }
    } else if (x !== 0) { tree(tiles, px - .3, pz, .65, .62); tree(tiles, px + .4, pz - .3, .55, .62); }
  }
  house(tiles, 0, 0, "#a96e50", 1.25, .64);
  const incoming = box(parent, [1.55, .18, 1.55], "#b7c48c", 3.1, .8, 2.3); incoming.rotation.y = .28;
  box(parent, [.3, .05, 1.55], "#e5ce9e", 3.1, .92, 2.3).rotation.y = .28;
  for (const [x, z, color] of [[-1.6, -.7, "#cc7152"], [.5, 1.6, "#4a82a1"]] as const) {
    const pawn = new T.Group(); parent.add(pawn); pawn.position.set(x, .66, z);
    disc(pawn, .22, .12, color, 0, .06); mesh(pawn, new T.ConeGeometry(.19, .48, 12), mat(color), 0, .32); mesh(pawn, new T.SphereGeometry(.15, 16, 12), mat(color), 0, .63);
  }
  return incoming;
}
