// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createDrawGuess, executeDrawGuess, taskFor } from "@catan/game-core/draw-guess";
import { projectDrawGuess } from "@catan/protocol/draw-guess";
import { useDraft } from "./use-draft.js";
import { sendDrawCommand } from "./api.js";
import { ApiError } from "../../http.js";
vi.mock("./api.js", () => ({ sendDrawCommand: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });
it("retries a lost reroll response with the same receipt and recovers ink without the old word", async () => {
  const state = createDrawGuess("reroll", ["a", "b", "c"].map((id) => ({ id, name: id })), 40);
  const game = projectDrawGuess(state, "a", null), onRoom = vi.fn();
  const { result } = renderHook(() => useDraft({ roomId: "ROOM", playerId: "a", seatToken: "token" }, game, game.task!, onRoom));
  const page = { kind: "opening" as const, word: state.suggestions.a![0]!, strokes: [{ color: "#222222", width: 8, points: [[1, 2]] as const }], background: "#fff3bf" };
  act(() => result.current.change(page));
  const next = executeDrawGuess(state, "a", { type: "reroll", matchId: state.id, taskId: game.task!.id, sequence: 2, page });
  vi.mocked(sendDrawCommand).mockRejectedValueOnce(new Error("response lost")).mockResolvedValueOnce({ game: projectDrawGuess(next, "a", null) } as Awaited<ReturnType<typeof sendDrawCommand>>);
  await act(() => result.current.reroll());
  expect(result.current.locked).toBe(true); expect(result.current.rerollError).toContain("尚未确认");
  act(() => result.current.change({ ...page, word: state.suggestions.a![1]! }));
  await act(() => result.current.submit());
  expect(vi.mocked(sendDrawCommand).mock.calls).toHaveLength(1);
  await act(() => result.current.reroll());
  const calls = vi.mocked(sendDrawCommand).mock.calls;
  expect(calls[1]).toEqual(calls[0]); expect(calls[0]![2]).toMatchObject({ type: "reroll", sequence: 2 });
  expect(result.current.locked).toBe(false); expect(result.current.rerollError).toBeNull();
  expect(result.current.page).toEqual({ ...page, word: "" });
  expect(JSON.parse(localStorage.getItem(localStorage.key(0)!)!).page).toEqual({ ...page, word: "" });
});

it("retries an uncertain submission with the exact same id and content", async () => {
  const state = createDrawGuess("match", ["a", "b", "c"].map((id) => ({ id, name: id })), 40);
  const game = projectDrawGuess(state, "a", null);
  const onRoom = vi.fn();
  const { result } = renderHook(() => useDraft({ roomId: "ROOM", playerId: "a", seatToken: "token" }, game, game.task!, onRoom));
  act(() => result.current.change({ kind: "opening", word: state.suggestions.a![0]!, strokes: [{ color: "#222222", width: 8, points: [[1, 2]] }] }));
  vi.mocked(sendDrawCommand).mockRejectedValueOnce(new Error("response lost")).mockResolvedValueOnce({} as Awaited<ReturnType<typeof sendDrawCommand>>);
  await act(() => result.current.submit()); expect(result.current.locked).toBe(true); expect(result.current.submitError).toBe("response lost");
  act(() => result.current.change({ kind: "opening", word: state.suggestions.a![1]!, strokes: [] }));
  await act(() => result.current.submit());
  const calls = vi.mocked(sendDrawCommand).mock.calls;
  expect(calls).toHaveLength(2); expect(calls[1]).toEqual(calls[0]);
  expect(calls[0]![2]).toMatchObject({ type: "submit", matchId: "match", taskId: game.task!.id, page: { kind: "opening", word: state.suggestions.a![0]!, strokes: [{ color: "#222222", width: 8, points: [[1, 2]] }] } });
  expect(onRoom).toHaveBeenCalledOnce();
});

it("unlocks a server-rejected guess so the player can correct its length and resubmit", async () => {
  let state = createDrawGuess("length", ["a", "b", "c"].map((id) => ({ id, name: id })), 40);
  for (const player of state.players) state = executeDrawGuess(state, player.id, { type: "submit", matchId: state.id, taskId: taskFor(state, player.id)!.id,
    page: { kind: "opening", word: state.suggestions[player.id]![0]!, strokes: [{ color: "#222222", width: 8, points: [[1, 2]] }] } });
  const game = projectDrawGuess(state, "a", null), length = game.task!.hintLength!;
  const { result } = renderHook(() => useDraft({ roomId: "ROOM", playerId: "a", seatToken: "token" }, game, game.task!, vi.fn()));
  vi.mocked(sendDrawCommand).mockRejectedValueOnce(new ApiError("GUESS_LENGTH_MISMATCH", `本轮需要 ${length} 个字`)).mockResolvedValueOnce({} as Awaited<ReturnType<typeof sendDrawCommand>>);
  act(() => result.current.change({ kind: "text", text: "猜".repeat(length + 1) }));
  await act(() => result.current.submit());
  expect(result.current.locked).toBe(false); expect(result.current.submitError).toContain("个字");
  act(() => result.current.change({ kind: "text", text: "猜".repeat(length) }));
  await act(() => result.current.submit());
  const calls = vi.mocked(sendDrawCommand).mock.calls;
  expect(calls[1]![1]).not.toBe(calls[0]![1]);
  expect(calls[1]![2]).toMatchObject({ page: { kind: "text", text: "猜".repeat(length) } });
});
