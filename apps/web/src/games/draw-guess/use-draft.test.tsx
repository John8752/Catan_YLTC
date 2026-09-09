// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createDrawGuess } from "@catan/game-core/draw-guess";
import { projectDrawGuess } from "@catan/protocol/draw-guess";
import { useDraft } from "./use-draft.js";
import { sendDrawCommand } from "./api.js";
vi.mock("./api.js", () => ({ sendDrawCommand: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });
it("retries an uncertain submission with the exact same id and content", async () => {
  const state = createDrawGuess("match", ["a", "b", "c"].map((id) => ({ id, name: id })), 40);
  const game = projectDrawGuess(state, "a", null);
  const onRoom = vi.fn();
  const { result } = renderHook(() => useDraft({ roomId: "ROOM", playerId: "a", seatToken: "token" }, game, game.task!, onRoom));
  act(() => result.current.change({ kind: "text", text: "企鹅修水管" }));
  vi.mocked(sendDrawCommand).mockRejectedValueOnce(new Error("response lost")).mockResolvedValueOnce({} as Awaited<ReturnType<typeof sendDrawCommand>>);
  await act(() => result.current.submit()); expect(result.current.locked).toBe(true); expect(result.current.submitError).toBe("response lost");
  act(() => result.current.change({ kind: "text", text: "不应覆盖已发送内容" }));
  await act(() => result.current.submit());
  const calls = vi.mocked(sendDrawCommand).mock.calls;
  expect(calls).toHaveLength(2); expect(calls[1]).toEqual(calls[0]);
  expect(calls[0]![2]).toMatchObject({ type: "submit", matchId: "match", taskId: game.task!.id, page: { kind: "text", text: "企鹅修水管" } });
  expect(onRoom).toHaveBeenCalledOnce();
});
