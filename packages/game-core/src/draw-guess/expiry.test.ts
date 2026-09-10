import { expect, it } from "vitest";
import { createDrawGuess, executeDrawGuess, taskFor, requiredGuessLength, type DrawGuessState } from "./index.js";

function pageFor(state: DrawGuessState, playerId: string) {
  const task = taskFor(state, playerId)!;
  const strokes = [{ color: "#222222", width: 8, points: [[10, 20]] as const }];
  return task.kind === "opening" ? { kind: "opening" as const, word: state.suggestions[playerId]![0]!, strokes }
    : task.kind === "drawing" ? { kind: "drawing" as const, strokes }
      : { kind: "text" as const, text: "猜".repeat(requiredGuessLength(state, task) ?? 3) };
}

it.each([3, 4, 5, 6])("expires only the old round across every pending-seat subset with %i players", (count) => {
  let base = createDrawGuess("expiry", Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `玩家${i}` })), 42);
  for (let step = 0; step < count; step++) {
    for (let pending = 1; pending < 2 ** count; pending++) {
      let state = base;
      for (let i = 0; i < count; i++) {
        const playerId = `p${i}`, task = taskFor(state, playerId)!;
        const command = { matchId: state.id, taskId: task.id, page: pageFor(state, playerId) };
        state = executeDrawGuess(state, playerId, pending & (1 << i) ? { ...command, type: "draft", sequence: 1 } : { ...command, type: "submit" });
      }
      const expired = executeDrawGuess(state, null, { type: "expire", matchId: state.id, step });
      expect(expired.phase).toEqual(step + 1 < count ? { kind: "work", step: step + 1 } : { kind: "reveal", cursor: 0 });
      for (const album of expired.albums) {
        expect(album.pages, `step=${step}, pending=${pending}`).toHaveLength(step + 1);
        expect(album.pages.at(-1)!.content.kind).not.toBe("missing");
      }
      if (step + 1 < count) for (const player of expired.players) expect(taskFor(expired, player.id)?.submitted).toBe(false);
    }
    for (const player of base.players) base = executeDrawGuess(base, player.id, { type: "submit", matchId: base.id, taskId: taskFor(base, player.id)!.id, page: pageFor(base, player.id) });
  }
});
