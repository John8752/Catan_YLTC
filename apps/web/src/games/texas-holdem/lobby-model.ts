import * as T from "three";
import { box, disc, mat, mesh } from "../../components/lobby/world-models.js";
function card(parent: T.Object3D, x: number, z: number, angle: number, rank: string, suit: string, color: string) {
  const c = new T.Group(); parent.add(c); c.position.set(x, .65, z); c.rotation.y = angle;
  box(c, [1.5, .055, 2.15], "#f9efda", 0, 0, 0, .08);
  const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 384;
  const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#f9efda"; ctx.fillRect(0, 0, 256, 384); ctx.fillStyle = color;
  ctx.font = "bold 68px Georgia"; ctx.fillText(rank, 23, 74); ctx.font = "58px Georgia"; ctx.fillText(suit, 24, 132);
  ctx.font = "134px Georgia"; ctx.textAlign = "center"; ctx.fillText(suit, 131, 280);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
  const face = mesh(c, new T.PlaneGeometry(1.45, 2.1), new T.MeshStandardMaterial({ map: texture, roughness: .85 }), 0, .03, 0); face.rotation.x = -Math.PI / 2;
  return c;
}
export function makeLobbyModel(parent: T.Group, waiting = false) {
  const rail = disc(parent, 4.4, .3, "#7c573b", 0, .33); rail.scale.z = .85;
  const trim = disc(parent, 4.16, .1, "#d4b67b", 0, .52); trim.scale.z = .85;
  const felt = disc(parent, 4.04, .08, "#326b58", 0, .6); felt.scale.z = .85;
  let ace: T.Object3D;
  if (waiting) {
    const deck = new T.Group(); parent.add(deck);
    for (let i = 0; i < 7; i++) box(deck, [1.5, .035, 2.15], i === 6 ? "#698b91" : "#f4e7ca", 0, .68 + i * .04, .3, .05);
    ace = deck;
  } else { card(parent, -.65, .6, -.18, "A", "♠", "#274336"); ace = card(parent, .65, .6, .15, "A", "♥", "#b45f47"); }
  for (let p = 0; p < 4; p++) for (let i = 0; i < 3 + p % 3; i++) {
    const x = -2.35 + p * 1.5, z = -1.7 + Math.abs(p - 1.5) * .15;
    disc(parent, .38, .12, ["#d4ae6a", "#d18065", "#ece0be", "#6b9e95"][p]!, x, .7 + i * .14, z, 40);
    const ring = mesh(parent, new T.TorusGeometry(.28, .014, 5, 32), mat("#f8e5ba"), x, .765 + i * .14, z); ring.rotation.x = Math.PI / 2;
  }
  disc(parent, .3, .09, "#efe5c9", 2.8, .72, 1.2);
  return ace;
}
