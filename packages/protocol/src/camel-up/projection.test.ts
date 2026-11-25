import { expect, it } from "vitest";
import { createCamelUp, executeCamelUp, RACING_CAMELS } from "@catan/game-core/camel-up";
import { projectCamelUp } from "./index.js";
it("projects own secret bets only, and supplies server-computed actions to the active seat", () => {
  let state = createCamelUp("m", ["a", "b", "c"].map(id => ({ id, name: id })), { positions: [1, 2, 3, 1, 2], order: RACING_CAMELS, crazyPositions: [1, 2] });
  state = executeCamelUp(state, "a", { type: "finish-bet", camel: "purple", kind: "loser", matchId: "m", expectedRevision: 0 });
  const a = projectCamelUp(state, "a"), b = projectCamelUp(state, "b");
  Object.assign(state.players[0]!, { seatToken: "hidden-seat", accountId: "hidden-account" });
  expect(JSON.stringify(projectCamelUp(state, "b"))).not.toContain("hidden-");
  expect(a.ownFinishBets).toHaveLength(1); expect(b.ownFinishBets).toEqual([]); expect(b.revealedFinishBets).toBeNull();
  expect(b.finishBetCounts).toEqual({ winner: 0, loser: 1 }); expect(a.legal.roll).toBe(false); expect(b.legal.roll).toBe(true);
  expect(b).not.toHaveProperty("finishBets");
  expect(b.effect).toMatchObject({ type: "finish-bet", camel: null, betKind: "loser" });
  expect(JSON.stringify(b.effect)).not.toContain("purple");
  b.players[0]!.coins = 100; expect(state.players[0]!.coins).toBe(3);
  state.phase = { kind: "finished", winnerIds: ["a"] };
  expect(projectCamelUp(state, "b").revealedFinishBets).toHaveLength(1);
});
