export interface TablePoint { x: number; y: number }
const opponentPositions: Record<number, readonly [number, number][]> = {
  2: [[50, 10]],
  3: [[12, 28], [88, 28]],
  4: [[10, 43], [50, 10], [90, 43]],
  5: [[10, 62], [17, 17], [83, 17], [90, 62]],
  6: [[10, 62], [10, 30], [50, 10], [90, 30], [90, 62]],
  7: [[10, 64], [10, 39], [30, 11], [70, 11], [90, 39], [90, 64]],
  8: [[10, 65], [9, 43], [12, 22], [50, 8], [88, 22], [91, 43], [90, 65]],
  9: [[10, 65], [9, 43], [12, 24], [37, 12], [63, 12], [88, 24], [91, 43], [90, 65]],
};
/** Rotate only the view: authoritative clockwise seat order never changes. */
export function pokerSeatPositions(ids: readonly string[], viewerId: string, height = 600): Map<string, TablePoint> {
  const viewer = Math.max(0, ids.indexOf(viewerId)), points = opponentPositions[ids.length] ?? [];
  const result = new Map<string, TablePoint>();
  ids.forEach((_, offset) => { const id = ids[(viewer + offset) % ids.length]!; const p = offset === 0 ? [50, Math.max(55, 100 - 14200 / height)] : points[offset - 1]!; result.set(id, { x: p[0]!, y: p[1]! }); });
  return result;
}
export function betPosition(point: TablePoint): TablePoint {
  if (point.x === 50 && point.y > 50) return { x: 50, y: point.y - 12 };
  const y = point.y + (45 - point.y) * .28;
  return { x: point.x + (50 - point.x) * .32, y: y > 35 && y < 51 ? 56 : y };
}
