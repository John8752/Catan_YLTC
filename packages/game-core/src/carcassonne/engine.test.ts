import { describe, expect, it } from "vitest";
import { createCarcassonne, executeCarcassonne, legalPlacements, previewPlacement, TILE_CATALOG, regions, type CarcassonneState, type PlacedTile } from "./index.js";

const players = [{ id: "a", name: "甲", color: "terracotta" as const }, { id: "b", name: "乙", color: "ocean" as const }];
const tile = (type: string, x: number, y: number, rotation = 0): PlacedTile => ({ id: `${x},${y}`, type, x, y, rotation });
function fixture(board: PlacedTile[], currentTile = "E", deck = ["B"]): CarcassonneState {
  return { ...createCarcassonne("match", players, 42), board, currentTile, deck, discarded: [], meeples: [], scores: [], phase: { kind: "turn", playerId: "a", turn: 1 } };
}
const command = (x: number, y: number, rotation = 0, meeple: string | null = null) => ({ type: "place" as const, matchId: "match", turn: 1, x, y, rotation, meeple });

describe("carcassonne base engine", () => {
  it("has exactly the 72 standard tiles including a single fixed starting D", () => {
    expect(TILE_CATALOG).toHaveLength(24);
    expect(TILE_CATALOG.reduce((n, t) => n + t.count, 0)).toBe(72);
    const a = createCarcassonne("match", players, 42), b = createCarcassonne("match", players, 42);
    expect(a).toEqual(b);
    expect(a.board).toEqual([tile("D", 0, 0)]);
    expect(a.deck.length + Number(a.currentTile !== null)).toBe(71);
    expect(createCarcassonne("match", players, 43).deck).not.toEqual(a.deck);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });
  it("validates adjacency, every touching edge, turn identity and untrusted coordinates", () => {
    const state = fixture([tile("D", 0, 0)]);
    for (const cmd of [command(0, 0), command(2, 2), command(1, 0), command(NaN, 1), command(0, 1, 4)]) {
      expect(() => executeCarcassonne(state, "a", cmd)).toThrow();
    }
    expect(() => executeCarcassonne(state, "b", command(0, -1, 2))).toThrow(/轮到/);
    expect(() => executeCarcassonne(state, "a", { ...command(0, -1, 2), matchId: "old" })).toThrow(/对局/);
    expect(() => executeCarcassonne(state, "a", { ...command(0, -1, 2), turn: 0 })).toThrow(/回合/);
    expect(legalPlacements(state.board, "E")).toContainEqual({ x: 0, y: -1, rotation: 2 });
    expect(state.board).toHaveLength(1);
  });
  it("places a meeple before scoring a completed city and returns it immediately", () => {
    const state = fixture([tile("E", 0, 0)]);
    const preview = previewPlacement(state, "a", { x: 0, y: -1, rotation: 2 });
    expect(preview.meepleOptions).toContain("c0");
    const next = executeCarcassonne(state, "a", command(0, -1, 2, "c0"));
    expect(next.players[0]!.score).toBe(4);
    expect(next.meeples).toHaveLength(0);
    expect(next.phase).toEqual({ kind: "turn", playerId: "b", turn: 2 });
    expect(state.players[0]!.score).toBe(0);
  });
  it("cannot place into a connected occupied area, including one's own", () => {
    const state = { ...fixture([tile("E", 0, 0)]), meeples: [{ playerId: "a", tileId: "0,0", featureId: "c0" }] };
    expect(previewPlacement(state, "a", { x: 0, y: -1, rotation: 2 }).meepleOptions).not.toContain("c0");
    expect(() => executeCarcassonne(state, "a", command(0, -1, 2, "c0"))).toThrow(/占领/);
  });
  it("scores tied majority in a merged city in full for each owner", () => {
    const state = { ...fixture([tile("E", -1, 0, 1), tile("E", 1, 0, 3)], "G"), meeples: [
      { playerId: "a", tileId: "-1,0", featureId: "c0" }, { playerId: "b", tileId: "1,0", featureId: "c0" },
    ] };
    const next = executeCarcassonne(state, "a", command(0, 0));
    expect(next.players.map((p) => p.score)).toEqual([6, 6]);
    expect(next.meeples).toHaveLength(0);
  });
  it("treats crossroads as separate terminated roads", () => {
    const roads = regions([tile("X", 0, 0)], []).filter((r) => r.kind === "road");
    expect(roads).toHaveLength(4);
    expect(roads.every((r) => r.openEnds === 1)).toBe(true);
  });
  it("keeps farmland halves separate across straight roads, joined around a monastery road end", () => {
    expect(regions([tile("U", 0, 0)], []).filter((r) => r.kind === "field")).toHaveLength(2);
    expect(regions([tile("A", 0, 0)], []).filter((r) => r.kind === "field")).toHaveLength(1);
    const fields = regions([tile("U", 0, 0), tile("U", 0, 1)], []).filter((r) => r.kind === "field");
    expect(fields).toHaveLength(2);
    expect(fields.every((r) => r.tileIds.length === 2)).toBe(true);
  });
  it("scores farmers once per distinct completed city and finalizes exactly once", () => {
    const state = fixture([tile("E", 0, 0), tile("E", 0, -1, 2)], "B", []);
    const next = executeCarcassonne(state, "a", command(1, 0, 0, "f0"));
    expect(next.phase.kind).toBe("finished");
    expect(next.players[0]!.score).toBe(3);
    expect(next.scores.filter((s) => s.kind === "field")).toHaveLength(1);
    expect(() => executeCarcassonne(next, "a", command(2, 0))).toThrow();
  });
  it("completes a monastery using all eight neighbors, including diagonals", () => {
    const board = [tile("B", 0, 0), ...[-1, 0, 1].flatMap((x) => [-1, 0, 1].filter((y) => (x !== 0 || y !== 0) && !(x === 1 && y === 1)).map((y) => tile("B", x, y)))];
    const state = { ...fixture(board, "B"), meeples: [{ playerId: "b", tileId: "0,0", featureId: "m0" }] };
    const next = executeCarcassonne(state, "a", command(1, 1));
    expect(next.players[1]!.score).toBe(9);
    expect(next.meeples).toHaveLength(0);
  });
  it("counts a road loop once and returns its occupant", () => {
    const state = { ...fixture([tile("V",0,0,3),tile("V",1,0),tile("V",1,1,1)],"V"),meeples:[{playerId:"b",tileId:"0,0",featureId:"r0"}] };
    const next=executeCarcassonne(state,"a",command(0,1,2));
    expect(next.players[1]!.score).toBe(4);expect(next.meeples).toHaveLength(0);
  });
  it("deduplicates a tile and a completed city that touch the same farm multiple times", () => {
    const board=[tile("H",0,0),tile("N",0,-1,2),tile("N",1,-1,3),tile("G",1,0,1),tile("N",1,1),tile("N",0,1,1)];
    const groups=regions(board,[{playerId:"a",tileId:"0,0",featureId:"c0"},{playerId:"a",tileId:"0,0",featureId:"c1"},{playerId:"b",tileId:"1,0",featureId:"c0"}]);
    const city=groups.find((g)=>g.kind==="city")!;
    expect(city.complete).toBe(true);expect(city.tileIds).toHaveLength(6);expect(city.points).toBe(12);expect(city.winnerIds).toEqual(["a"]);
    const field=groups.find((g)=>g.refs.includes("0,0/f0"))!;
    expect(field.completedCityIds).toHaveLength(1);expect(field.points).toBe(3);
  });
  it("scores farmer majority and retains farmers in the final explanatory tableau", () => {
    const state={...fixture([tile("E",0,0),tile("E",0,-1,2),tile("B",1,0),tile("B",1,1)],"B",[]),meeples:[
      {playerId:"a",tileId:"0,0",featureId:"f0"},{playerId:"a",tileId:"1,1",featureId:"f0"},{playerId:"b",tileId:"1,0",featureId:"f0"},
    ]};
    const next=executeCarcassonne(state,"a",command(2,0));
    expect(next.players.map((p)=>p.score)).toEqual([3,0]);expect(next.meeples).toHaveLength(3);
  });
  it("discards an unplaceable full-city tile, then ends if the deck is exhausted", () => {
    const state=fixture([tile("B",0,0)],"B",["C"]);
    const next=executeCarcassonne(state,"a",command(1,0,0,"m0"));
    expect(next.phase.kind).toBe("finished");expect(next.discarded).toEqual(["C"]);expect(next.players[0]!.score).toBe(2);
  });
  it("assigns each exposed field half exactly once and rotates without changing connectivity", () => {
    for(const t of TILE_CATALOG){
      const cities=t.features.filter((f)=>f.kind==="city").flatMap((f)=>f.ports);
      const halves=t.features.filter((f)=>f.kind==="field").flatMap((f)=>f.ports);
      expect(new Set(halves).size,t.id).toBe(halves.length);
      expect([...halves].sort((a,b)=>a-b),t.id).toEqual([0,1,2,3,4,5,6,7].filter((p)=>!cities.includes(Math.floor(p/2))));
      for(let rotation=0;rotation<4;rotation++)expect(regions([tile(t.id,0,0,rotation)],[]).map((g)=>[g.kind,g.openEnds,g.shields])).toEqual(regions([tile(t.id,0,0)],[]).map((g)=>[g.kind,g.openEnds,g.shields]));
    }
  });
  it("replays a complete 5-player match deterministically, preserving supplies", () => {
    const five = [...players, { id: "c", name: "丙", color: "orange" as const }, { id: "d", name: "丁", color: "wheat" as const }, { id: "e", name: "戊", color: "pine" as const }];
    let state = createCarcassonne("match", five, 918), replay = state;
    let turns = 0;
    while (state.phase.kind === "turn") {
      const placement = legalPlacements(state.board, state.currentTile!)[turns % legalPlacements(state.board, state.currentTile!).length]!;
      const preview = previewPlacement(state, state.phase.playerId, placement);
      const cmd = { ...command(placement.x, placement.y, placement.rotation, preview.meepleOptions[turns % (preview.meepleOptions.length + 1)] ?? null), turn: state.phase.turn };
      replay = executeCarcassonne(replay, state.phase.playerId, cmd);
      state = executeCarcassonne(state, state.phase.playerId, cmd);
      expect(state).toEqual(replay);
      for (const player of state.players) expect(state.meeples.filter((m) => m.playerId === player.id).length).toBeLessThanOrEqual(7);
      expect(++turns).toBeLessThanOrEqual(71);
    }
    expect(state.board.length + state.discarded.length).toBe(72);
    expect(state.players.every((p) => Number.isInteger(p.score) && p.score >= 0)).toBe(true);
    expect(state.phase.kind === "finished" && state.phase.winnerIds.length).toBeGreaterThan(0);
  });
});
