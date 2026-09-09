// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { draftKey, readDraft, removeDraft, writeDraft, pruneDrafts } from "./drafts.js";
beforeEach(() => localStorage.clear());
const session = { roomId: "ROOM", playerId: "a", seatToken: "private-credential" };
it("scopes recovery to match, task and player; never stores the seat credential", () => {
  const key = draftKey(session, "one", "task"); const draft = { sequence: 5, page: { kind: "text" as const, text: "原地起飞的企鹅" } };
  expect(writeDraft(localStorage, key, draft)).toBe(true); expect(readDraft(localStorage, key, "text")).toEqual(draft);
  expect(readDraft(localStorage, draftKey(session, "two", "task"), "text")).toBeNull();
  expect(readDraft(localStorage, draftKey({ ...session, playerId: "b" }, "one", "task"), "text")).toBeNull();
  expect(JSON.stringify({ ...localStorage })).not.toContain(session.seatToken);
  removeDraft(localStorage, key); expect(localStorage.length).toBe(0);
});
it("ignores damaged, oversized or expired drafts and tolerates storage failures", () => {
  const key = draftKey(session, "one", "task");
  localStorage.setItem(key, "bad JSON"); expect(readDraft(localStorage, key, "text")).toBeNull();
  localStorage.setItem(key, JSON.stringify({ savedAt: 1, sequence: 1, page: { kind: "text", text: "old" } })); pruneDrafts(localStorage); expect(localStorage.length).toBe(0);
  const blocked = { setItem() { throw Error("quota"); } } as unknown as Storage;
  expect(writeDraft(blocked, key, { sequence: 1, page: { kind: "text", text: "a" } })).toBe(false);
});
