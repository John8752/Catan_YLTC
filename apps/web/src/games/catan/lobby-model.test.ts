import * as T from "three";
import { expect, it } from "vitest";
import { makeLobbyModel } from "./lobby-model.js";
import { release } from "../../components/lobby/world-models.js";

function terrain(root: T.Group) {
  return root.children.filter((object): object is T.Mesh<T.CylinderGeometry> => object instanceof T.Mesh && object.geometry instanceof T.CylinderGeometry && object.geometry.parameters.radialSegments === 6);
}
function topPolygon(tile: T.Mesh<T.CylinderGeometry>) {
  tile.updateWorldMatrix(true, false);
  const vertices = tile.geometry.getAttribute("position"), points = new Map<string, T.Vector2>();
  for (let i = 0; i < vertices.count; i++) {
    const local = new T.Vector3().fromBufferAttribute(vertices, i);
    if (local.y <= 0 || Math.hypot(local.x, local.z) < .5) continue;
    const world = local.applyMatrix4(tile.matrixWorld);
    points.set(`${world.x.toFixed(6)},${world.z.toFixed(6)}`, new T.Vector2(world.x, world.z));
  }
  return [...points.values()].sort((a, b) => Math.atan2(a.y - tile.position.z, a.x - tile.position.x) - Math.atan2(b.y - tile.position.z, b.x - tile.position.x));
}
function separated(a: T.Vector2[], b: T.Vector2[]) {
  return [a, b].some(polygon => polygon.some((point, i) => {
    const edge = polygon[(i + 1) % polygon.length]!.clone().sub(point), axis = new T.Vector2(-edge.y, edge.x).normalize();
    const ap = a.map(p => p.dot(axis)), bp = b.map(p => p.dot(axis));
    return Math.max(...ap) <= Math.min(...bp) + 1e-6 || Math.max(...bp) <= Math.min(...ap) + 1e-6;
  }));
}

it("keeps all nineteen terrain top faces disjoint instead of z-fighting", () => {
  const root = new T.Group(); makeLobbyModel(root);
  try {
    const tiles = terrain(root), polygons = tiles.map(topPolygon); expect(tiles).toHaveLength(19);
    const overlaps: string[] = [];
    for (let i = 0; i < polygons.length; i++) for (let j = i + 1; j < polygons.length; j++) if (!separated(polygons[i]!, polygons[j]!)) overlaps.push(`${i}:${j}`);
    expect(overlaps).toEqual([]);
  } finally { release(root); }
});

it("keeps the terrain bases above the water surface", () => {
  const root = new T.Group(); makeLobbyModel(root);
  try {
    const water = root.children.filter((object): object is T.Mesh => object instanceof T.Mesh && object.geometry instanceof T.CylinderGeometry && object.geometry.parameters.radiusTop > 4);
    const surface = Math.max(...water.map(object => new T.Box3().setFromObject(object).max.y));
    for (const tile of terrain(root)) expect(new T.Box3().setFromObject(tile).min.y).toBeGreaterThan(surface + .01);
  } finally { release(root); }
});
