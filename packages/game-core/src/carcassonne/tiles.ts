import type { FeatureDefinition, FeatureKind, TileDefinition } from "./types.js";

const feature = (id: string, kind: FeatureKind, ports: number[], cities: string[] = [], shields = 0): FeatureDefinition => ({ id, kind, ports, cities, shields });
const c = (ports: number[], shields = 0, id = "c0") => feature(id, "city", ports, [], shields);
const r = (ports: number[], id = "r0") => feature(id, "road", ports);
const f = (ports: number[], cities: string[] = [], id = "f0") => feature(id, "field", ports, cities);
const m = () => feature("m0", "monastery", []);
const t = (id: string, count: number, ...features: FeatureDefinition[]): TileDefinition => ({ id, count, features });
/** Rule facts from the publisher's base tile list. All display art is original. */
export const TILE_CATALOG: readonly TileDefinition[] = [
  t("A", 2, m(), r([2]), f([0,1,2,3,4,5,6,7])),
  t("B", 4, m(), f([0,1,2,3,4,5,6,7])),
  t("C", 1, c([0,1,2,3], 1)),
  t("D", 4, c([0]), r([1,3]), f([2,7], ["c0"]), f([3,4,5,6], [], "f1")),
  t("E", 5, c([0]), f([2,3,4,5,6,7], ["c0"])),
  t("F", 2, c([1,3], 1), f([0,1], ["c0"]), f([4,5], ["c0"], "f1")),
  t("G", 1, c([1,3]), f([0,1], ["c0"]), f([4,5], ["c0"], "f1")),
  t("H", 3, c([0]), c([2], 0, "c1"), f([2,3,6,7], ["c0","c1"])),
  t("I", 2, c([0]), c([3], 0, "c1"), f([2,3,4,5], ["c0","c1"])),
  t("J", 3, c([0]), r([1,2]), f([2,5,6,7], ["c0"]), f([3,4], [], "f1")),
  t("K", 3, c([0]), r([2,3]), f([2,3,4,7], ["c0"]), f([5,6], [], "f1")),
  t("L", 3, c([0]), r([1], "r0"), r([2], "r1"), r([3], "r2"), f([2,7], ["c0"]), f([3,4], [], "f1"), f([5,6], [], "f2")),
  t("M", 2, c([0,3], 1), f([2,3,4,5], ["c0"])),
  t("N", 3, c([0,3]), f([2,3,4,5], ["c0"])),
  t("O", 2, c([0,3], 1), r([1,2]), f([2,5], ["c0"]), f([3,4], [], "f1")),
  t("P", 3, c([0,3]), r([1,2]), f([2,5], ["c0"]), f([3,4], [], "f1")),
  t("Q", 1, c([0,1,3], 1), f([4,5], ["c0"])),
  t("R", 3, c([0,1,3]), f([4,5], ["c0"])),
  t("S", 2, c([0,1,3], 1), r([2]), f([4], ["c0"]), f([5], ["c0"], "f1")),
  t("T", 1, c([0,1,3]), r([2]), f([4], ["c0"]), f([5], ["c0"], "f1")),
  t("U", 8, r([0,2]), f([0,5,6,7]), f([1,2,3,4], [], "f1")),
  t("V", 9, r([2,3]), f([0,1,2,3,4,7]), f([5,6], [], "f1")),
  t("W", 4, r([1], "r0"), r([2], "r1"), r([3], "r2"), f([0,1,2,7]), f([3,4], [], "f1"), f([5,6], [], "f2")),
  t("X", 1, r([0], "r0"), r([1], "r1"), r([2], "r2"), r([3], "r3"), f([0,7]), f([1,2], [], "f1"), f([3,4], [], "f2"), f([5,6], [], "f3")),
];
export function tileDefinition(id: string): TileDefinition {
  const tile = TILE_CATALOG.find((tile) => tile.id === id);
  if (!tile) throw new Error(`Unknown tile: ${id}`);
  return tile;
}
export function rotatedFeatures(type: string, rotation: number): readonly FeatureDefinition[] {
  return tileDefinition(type).features.map((f) => ({ ...f, ports: f.ports.map((p) => (p + rotation * (f.kind === "field" ? 2 : 1)) % (f.kind === "field" ? 8 : 4)) }));
}
export function tileEdges(type: string, rotation: number): readonly ("city" | "road" | "field")[] {
  const features = rotatedFeatures(type, rotation);
  return [0,1,2,3].map((side) => features.some((f) => f.kind === "city" && f.ports.includes(side)) ? "city" : features.some((f) => f.kind === "road" && f.ports.includes(side)) ? "road" : "field");
}
