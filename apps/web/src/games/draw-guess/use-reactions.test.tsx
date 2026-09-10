// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useReactions } from "./use-reactions.js";
import { sendDrawCommand } from "./api.js";
vi.mock("./api.js", () => ({ sendDrawCommand: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const session = { roomId: "ROOM", playerId: "a", seatToken: "token" };
it("retains every rapid click across rerenders and retries an uncertain click with its receipt", async () => {
  const onRoom = vi.fn();
  vi.mocked(sendDrawCommand).mockRejectedValueOnce(new Error("response lost")).mockResolvedValue({} as Awaited<ReturnType<typeof sendDrawCommand>>);
  const { result, rerender } = renderHook(() => useReactions(session, "match", onRoom));
  act(() => { result.current.react("a", 0, "up"); result.current.react("a", 0, "up"); result.current.react("b", 1, "down"); });
  await waitFor(() => expect(result.current.error).toContain("response lost"));
  expect(result.current.pending).toBe(3);
  rerender();
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.pending).toBe(0));
  const calls = vi.mocked(sendDrawCommand).mock.calls;
  expect(calls).toHaveLength(4); expect(calls[1]).toEqual(calls[0]);
  expect(new Set(calls.map((call) => call[1])).size).toBe(3);
  expect(calls.slice(1).map((call) => call[2])).toEqual([
    { type: "react", matchId: "match", albumOwnerId: "a", step: 0, reaction: "up" },
    { type: "react", matchId: "match", albumOwnerId: "a", step: 0, reaction: "up" },
    { type: "react", matchId: "match", albumOwnerId: "b", step: 1, reaction: "down" },
  ]);
  expect(onRoom).toHaveBeenCalledTimes(3);
});
