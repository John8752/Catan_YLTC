// @vitest-environment jsdom
import * as T from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { makeLobbyModel } from "./lobby-model.js";
import { release } from "../../components/lobby/world-models.js";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ fillRect() {}, fillText() {} } as unknown as CanvasRenderingContext2D);
});
afterEach(() => vi.restoreAllMocks());
function textured(object: T.Object3D) {
  return object instanceof T.Mesh && (Array.isArray(object.material) ? object.material : [object.material]).some(material => material instanceof T.MeshStandardMaterial && material.map !== null);
}

it("separates overlapping card slabs and keeps them above the felt", () => {
  const root = new T.Group(); makeLobbyModel(root);
  try {
    const cards = root.children.filter(object => object instanceof T.Group && object.children.some(textured));
    expect(cards).toHaveLength(2);
    const bounds = cards.map(card => new T.Box3().setFromObject(card)).sort((a, b) => a.min.y - b.min.y);
    expect(bounds[1]!.min.y - bounds[0]!.max.y).toBeGreaterThan(.01);
    const felt = root.children.find(object => object instanceof T.Mesh && object.geometry instanceof T.CylinderGeometry && object.geometry.parameters.radiusTop === 4.04)!;
    expect(bounds[0]!.min.y - new T.Box3().setFromObject(felt).max.y).toBeGreaterThan(.01);
  } finally { release(root); }
});

it("prints each card on its own surface rather than a competing overlay plane", () => {
  const root = new T.Group(); makeLobbyModel(root);
  try {
    const faces: T.Mesh[] = []; root.traverse(object => { if (object instanceof T.Mesh && textured(object)) faces.push(object); });
    expect(faces).toHaveLength(2);
    for (const face of faces) expect(face.geometry.type).not.toBe("PlaneGeometry");
  } finally { release(root); }
});
