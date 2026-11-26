import * as T from "three";
import { box, disc, tree, house, die, mat, mesh } from "../../components/lobby/world-models.js";
export function makeLobbyModel(parent: T.Group) {
  disc(parent, 4.35, .22, "#439d9e", 0, .29);
  disc(parent, 4.12, .045, "#66b4af", 0, .42);
  const colors = ["#8ba36b", "#d3b96a", "#608c65", "#c48a65", "#9caa9b", "#789a60", "#c9b17b"];
  let n = 0;
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) {
    if (Math.abs(q + r) > 2) continue;
    const x = Math.sqrt(3) * .72 * (q + r / 2), z = 1.5 * .72 * r;
    const tile = mesh(parent, new T.CylinderGeometry(.71, .71, .18, 6), mat(colors[n % colors.length]!), x, .52, z); tile.rotation.y = Math.PI / 6;
    if (n % 5 === 0) { tree(parent, x - .15, z, .75, .62); tree(parent, x + .23, z + .15, .55, .62); }
    if (n % 5 === 2) { const rock = mesh(parent, new T.DodecahedronGeometry(.4, 0), mat("#bfc3b0"), x, .82, z); rock.scale.set(1, 1.2, .8); }
    if (n % 5 === 1) for (let j = 0; j < 4; j++) box(parent, [.08, .27, .12], "#ebd18c", x - .2 + j * .14, .75, z, .03);
    n++;
  }
  for (const [x, z, color] of [[-1.9, 1.4, "#d36e4e"], [.65, 2.1, "#396d97"], [1.9, -.7, "#c7704a"]] as const) house(parent, x, z, color, .95, .62);
  for (let i = 0; i < 3; i++) { const road = box(parent, [.68, .13, .12], "#cd6c4d", -1.6 + i * .55, .67, 1.8 - i * .3, .04); road.rotation.y = .5; }
  const boat = new T.Group(); parent.add(boat); boat.position.set(3.3, .48, .7); boat.rotation.y = -.3;
  box(boat, [.4, .16, .85], "#e6c99b"); disc(boat, .025, 1, "#c8ab7b", 0, .55);
  const sail = new T.Shape(); sail.moveTo(0, 0); sail.lineTo(.5, -.65); sail.lineTo(0, -.65);
  const cloth = mesh(boat, new T.ShapeGeometry(sail), new T.MeshStandardMaterial({ color: "#fff0ca", side: T.DoubleSide }), 0, 1, 0); cloth.rotation.y = -.5;
  die(parent, -3.2, 2.5);
  return boat;
}
