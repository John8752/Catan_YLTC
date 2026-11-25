import { rotatedFeatures, tileEdges } from "./tiles.js";
import type { FeatureDefinition, Meeple, Placement, PlacedTile, Region } from "./types.js";

export const DIRECTIONS = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }] as const;
export const coordinateId = (x: number, y: number) => `${x},${y}`;
export const featureRef = (tileId: string, featureId: string) => `${tileId}/${featureId}`;
export function validPlacement(board: readonly PlacedTile[], type: string, placement: Placement): boolean {
  const { x, y, rotation } = placement;
  if (![x,y,rotation].every(Number.isSafeInteger) || Math.abs(x) > 72 || Math.abs(y) > 72 || rotation < 0 || rotation > 3) return false;
  if (board.some((tile) => tile.x === x && tile.y === y)) return false;
  const edges = tileEdges(type, rotation);
  let adjacent = false;
  for (const [side, delta] of DIRECTIONS.entries()) {
    const neighbor = board.find((tile) => tile.x === x + delta.x && tile.y === y + delta.y);
    if (!neighbor) continue;
    adjacent = true;
    if (edges[side] !== tileEdges(neighbor.type, neighbor.rotation)[(side + 2) % 4]) return false;
  }
  return adjacent;
}
export function legalPlacements(board: readonly PlacedTile[], type: string): Placement[] {
  const candidates = new Map<string, { x: number; y: number }>();
  for (const tile of board) for (const d of DIRECTIONS) candidates.set(coordinateId(tile.x + d.x, tile.y + d.y), { x: tile.x + d.x, y: tile.y + d.y });
  return [...candidates.values()].flatMap((p) => [0,1,2,3].filter((rotation) => validPlacement(board, type, { ...p, rotation })).map((rotation) => ({ ...p, rotation })));
}
interface Node { readonly tile: PlacedTile; readonly feature: FeatureDefinition; readonly links: string[]; open: number }
/** Rebuild a small graph (<=72 tiles). Explicit half-edge topology handles fields without pixel inference. */
export function regions(board: readonly PlacedTile[], meeples: readonly Meeple[]): Region[] {
  const positions = new Map(board.map((t) => [coordinateId(t.x, t.y), t]));
  const features = new Map(board.map((t) => [t.id, rotatedFeatures(t.type, t.rotation)]));
  const nodes = new Map<string, Node>();
  for (const tile of board) for (const feature of features.get(tile.id)!) nodes.set(featureRef(tile.id, feature.id), { tile, feature, links: [], open: 0 });
  for (const node of nodes.values()) {
    const { tile, feature } = node;
    if (feature.kind === "monastery") {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && !positions.has(coordinateId(tile.x + dx, tile.y + dy))) node.open++;
      continue;
    }
    for (const port of feature.ports) {
      const side = feature.kind === "field" ? Math.floor(port / 2) : port, d = DIRECTIONS[side]!;
      const neighbor = positions.get(coordinateId(tile.x + d.x, tile.y + d.y));
      const opposite = feature.kind === "field" ? (((side + 2) % 4) * 2 + 1 - port % 2) : (side + 2) % 4;
      const target = neighbor && features.get(neighbor.id)!.find((f) => f.kind === feature.kind && f.ports.includes(opposite));
      if (neighbor && target) node.links.push(featureRef(neighbor.id, target.id));
      else node.open++;
    }
  }
  const visited = new Set<string>();
  const groups: Region[] = [];
  for (const [start, node] of nodes) {
    if (visited.has(start)) continue;
    const queue = [start], refs: string[] = []; let openEnds = 0, shields = 0;
    while (queue.length) {
      const ref = queue.pop()!;
      if (visited.has(ref)) continue;
      visited.add(ref); refs.push(ref);
      const item = nodes.get(ref)!; openEnds += item.open; shields += item.feature.shields;
      queue.push(...item.links.filter((link) => !visited.has(link)));
    }
    refs.sort();
    const tileIds = [...new Set(refs.map((ref) => nodes.get(ref)!.tile.id))];
    const followers: Record<string, number> = {};
    for (const meeple of meeples) if (refs.includes(featureRef(meeple.tileId, meeple.featureId))) followers[meeple.playerId] = (followers[meeple.playerId] ?? 0) + 1;
    const most = Math.max(0, ...Object.values(followers));
    const complete = node.feature.kind !== "field" && openEnds === 0;
    const kind = node.feature.kind;
    const points = kind === "monastery" ? 9 - openEnds : kind === "city" ? (tileIds.length + shields) * (complete ? 2 : 1) : kind === "road" ? tileIds.length : 0;
    groups.push({ id: refs[0]!, kind, refs, tileIds, openEnds, shields, complete, followers, winnerIds: Object.keys(followers).filter((id) => followers[id] === most), completedCityIds: [], points });
  }
  const cityRefs = new Map(groups.filter((g) => g.kind === "city" && g.complete).flatMap((g) => g.refs.map((ref) => [ref, g.id] as const)));
  return groups.map((g) => {
    if (g.kind !== "field") return g;
    const cities = new Set(g.refs.flatMap((ref) => { const n = nodes.get(ref)!; return n.feature.cities.flatMap((id) => { const found = cityRefs.get(featureRef(n.tile.id, id)); return found ? [found] : []; }); }));
    return { ...g, completedCityIds: [...cities], points: cities.size * 3 };
  });
}
