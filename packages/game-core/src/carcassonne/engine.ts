import { CARCASSONNE_PLAYER_LIMITS } from "./player-limits.js";
import { createSeededRandom, shuffled } from "../primitives/index.js";
import { coordinateId, featureRef, legalPlacements, regions, validPlacement } from "./map.js";
import { rotatedFeatures, TILE_CATALOG } from "./tiles.js";
import { CarcassonneError, type CarcassonnePlayer, type CarcassonneState, type Placement, type PlaceCommand, type PlacedTile, type Region } from "./types.js";

export function createCarcassonne(id: string, players: readonly Omit<CarcassonnePlayer, "score">[], seed: number): CarcassonneState {
  if (players.length < CARCASSONNE_PLAYER_LIMITS.min || players.length > CARCASSONNE_PLAYER_LIMITS.max || new Set(players.map((p) => p.id)).size !== players.length) throw new CarcassonneError("INVALID_PLAYERS", "卡卡颂需要 2–5 位不同玩家");
  const deck = shuffled(TILE_CATALOG.flatMap((t) => Array.from({ length: t.count - Number(t.id === "D") }, () => t.id)), createSeededRandom(seed));
  const state: CarcassonneState = { id, revision: 1, players: players.map((p) => ({ ...p, score: 0 })), board: [{ id: "0,0", type: "D", x: 0, y: 0, rotation: 0 }],
    phase: { kind: "turn", playerId: players[0]!.id, turn: 1 }, meeples: [], currentTile: null, deck, discarded: [], scores: [] };
  return drawNext(state);
}
export function previewPlacement(state: CarcassonneState, playerId: string, placement: Placement): { readonly tile: PlacedTile; readonly meepleOptions: readonly string[] } {
  assertActor(state, playerId);
  if (!state.currentTile || !validPlacement(state.board, state.currentTile, placement)) throw new CarcassonneError("ILLEGAL_PLACEMENT", "这里无法拼接当前板块，请检查相邻边");
  const tile: PlacedTile = { ...placement, id: coordinateId(placement.x, placement.y), type: state.currentTile };
  if (state.meeples.filter((m) => m.playerId === playerId).length >= 7) return { tile, meepleOptions: [] };
  const groups = regions([...state.board, tile], state.meeples);
  return { tile, meepleOptions: rotatedFeatures(tile.type, tile.rotation).filter((f) => {
    const area = groups.find((g) => g.refs.includes(featureRef(tile.id, f.id)))!;
    return Object.keys(area.followers).length === 0;
  }).map((f) => f.id) };
}
export function executeCarcassonne(state: CarcassonneState, playerId: string, command: PlaceCommand): CarcassonneState {
  if (command.matchId !== state.id) throw new CarcassonneError("STALE_MATCH", "操作属于其他对局，请重新连接");
  assertActor(state, playerId);
  if (state.phase.kind !== "turn" || command.turn !== state.phase.turn) throw new CarcassonneError("STALE_TURN", "这个回合已经结束，请查看最新地图");
  if (command.type !== "place") throw new CarcassonneError("INVALID_COMMAND", "未知操作");
  const preview = previewPlacement(state, playerId, command);
  if (command.meeple !== null && !preview.meepleOptions.includes(command.meeple)) throw new CarcassonneError("FEATURE_OCCUPIED", "该区域已被占领、目标无效或没有可用随从");
  let next: CarcassonneState = { ...state, revision: state.revision + 1, board: [...state.board, preview.tile], currentTile: null,
    meeples: command.meeple === null ? [...state.meeples] : [...state.meeples, { playerId, tileId: preview.tile.id, featureId: command.meeple }] };
  next = scoreAreas(next, regions(next.board, next.meeples).filter((g) => g.complete), false);
  const index = state.players.findIndex((p) => p.id === playerId);
  next = { ...next, phase: { kind: "turn", playerId: state.players[(index + 1) % state.players.length]!.id, turn: command.turn + 1 } };
  return drawNext(next);
}
function assertActor(state: CarcassonneState, playerId: string) {
  if (state.phase.kind !== "turn") throw new CarcassonneError("GAME_FINISHED", "对局已结束");
  if (state.phase.playerId !== playerId) throw new CarcassonneError("NOT_YOUR_TURN", "还没轮到你行动");
}
function scoreAreas(state: CarcassonneState, groups: readonly Region[], final: boolean): CarcassonneState {
  let players = [...state.players], meeples = [...state.meeples]; const scores = [...state.scores];
  for (const g of groups) {
    if (!g.winnerIds.length) continue;
    players = players.map((p) => g.winnerIds.includes(p.id) ? { ...p, score: p.score + g.points } : p);
    scores.push({ id: scores.length + 1, kind: g.kind, points: g.points, playerIds: [...g.winnerIds], tileIds: [...g.tileIds], final });
    // Farmers remain on their fields through the final tableau, to explain its score.
    if (g.kind !== "field") meeples = meeples.filter((m) => !g.refs.includes(featureRef(m.tileId, m.featureId)));
  }
  return { ...state, players, meeples, scores };
}
function drawNext(state: CarcassonneState): CarcassonneState {
  const deck = [...state.deck], discarded = [...state.discarded];
  while (deck.length) {
    const currentTile = deck.shift()!;
    if (legalPlacements(state.board, currentTile).length) return { ...state, deck, discarded, currentTile };
    discarded.push(currentTile);
  }
  const final = scoreAreas({ ...state, deck, discarded, currentTile: null }, regions(state.board, state.meeples), true);
  const high = Math.max(...final.players.map((p) => p.score));
  return { ...final, phase: { kind: "finished", winnerIds: final.players.filter((p) => p.score === high).map((p) => p.id) } };
}
