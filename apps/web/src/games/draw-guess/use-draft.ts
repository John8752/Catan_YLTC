import { useEffect, useRef, useState } from "react";
import type { Draft, EditablePage, DrawGuessPlayerCommand } from "@catan/game-core/draw-guess";
import type { DrawGuessRoomView, DrawGuessView } from "@catan/protocol/draw-guess";
import { ApiError } from "../../http.js";
import { getRoom } from "../../api.js";
import { type PlayerSession } from "../../room-session.js";
import type { AnyRoomView } from "@catan/protocol/platform";
import { randomId } from "../../lib/random-id.js";
import { draftKey, readDraft, writeDraft, removeDraft, pruneDrafts } from "./drafts.js";
import { sendDrawCommand } from "./api.js";

/** Mounted with key=task.id. Each request remains scoped to that seat/match/task. */
export function useDraft(session: PlayerSession, game: DrawGuessView, task: NonNullable<DrawGuessView["task"]>, onRoom: (room: AnyRoomView) => void) {
  const key = draftKey(session, game.id, task.id);
  const [draft, setDraft] = useState<Draft>(() => {
    const local = readDraft(window.localStorage, key, task.kind); const remote = task.draft;
    return (local && local.sequence > (remote?.sequence ?? 0) ? local : remote) ?? { sequence: 0, page: task.kind === "text" ? { kind: "text", text: "" } : task.kind === "opening" ? { kind: "opening", word: "", strokes: [] } : { kind: "drawing", strokes: [] } };
  });
  const current = useRef(draft); current.current = draft;
  const saved = useRef(task.draft?.sequence ?? 0);
  const roomCallback = useRef(onRoom); roomCallback.current = onRoom;
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pending = useRef<{ readonly id: string; readonly command: DrawGuessPlayerCommand } | null>(null);
  const rerollPending = useRef<{ readonly id: string; readonly command: Extract<DrawGuessPlayerCommand, { type: "reroll" }> } | null>(null);
  const [rerolling, setRerolling] = useState(false);
  const [rerollError, setRerollError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const finished = useRef(task.submitted); finished.current = task.submitted;
  useEffect(() => { pruneDrafts(window.localStorage); }, []);
  useEffect(() => {
    if (!task.submitted) return;
    removeDraft(window.localStorage, key); pending.current = null;
  }, [task.submitted, key]);
  useEffect(() => {
    if (task.draft && task.draft.sequence > current.current.sequence && !pending.current && !rerollPending.current) {
      current.current = task.draft; setDraft(task.draft); saved.current = task.draft.sequence;
    }
  }, [task.draft]);
  useEffect(() => {
    if (task.submitted || draft.sequence === 0) return;
    const timer = setTimeout(() => { writeDraft(window.localStorage, key, draft); }, 200);
    return () => clearTimeout(timer);
  }, [draft, key, task.submitted]);
  useEffect(() => {
    let active = true; let inFlight = false;
    const saveLocal = () => { if (!finished.current && current.current.sequence > 0) writeDraft(window.localStorage, key, current.current); };
    const checkpoint = async () => {
      const copy = current.current;
      if (!active || inFlight || finished.current || pending.current || rerollPending.current || copy.sequence <= saved.current) return;
      inFlight = true;
      try {
        const room: DrawGuessRoomView = await sendDrawCommand(session, randomId(), { type: "draft", matchId: game.id, taskId: task.id, sequence: copy.sequence, page: copy.page });
        if (active) { saved.current = Math.max(saved.current, copy.sequence); roomCallback.current(room); }
      } catch (error) {
        if (active) {
          if (error instanceof ApiError && ["STALE_TASK", "STALE_MATCH"].includes(error.code)) {
            try { const room = await getRoom(session); if (active) roomCallback.current(room); } catch { /* Reconnect also recovers. */ }
          }
        }
      } finally { inFlight = false; }
    };
    const timer = setInterval(() => void checkpoint(), 1_000);
    window.addEventListener("pagehide", saveLocal);
    return () => { active = false; clearInterval(timer); window.removeEventListener("pagehide", saveLocal); if (!finished.current) saveLocal(); };
  }, [session, game.id, task.id, key]);
  function change(page: EditablePage) {
    if (task.submitted || pending.current || rerollPending.current) return;
    const next = { sequence: current.current.sequence + 1, page }; current.current = next; setDraft(next);
  }
  async function submit() {
    if (submitting || task.submitted || rerollPending.current) return;
    pending.current ??= { id: randomId(), command: { type: "submit", matchId: game.id, taskId: task.id, page: current.current.page } };
    const request = pending.current; setLocked(true); setSubmitting(true); setSubmitError(null);
    try { const room = await sendDrawCommand(session, request.id, request.command); finished.current = true; removeDraft(window.localStorage, key); roomCallback.current(room); }
    catch (error) {
      if (error instanceof ApiError) {
        // Definite rejection means this content was not accepted; permit editing after validation errors.
        if (["INVALID_PAGE", "INVALID_REQUEST", "GUESS_LENGTH_MISMATCH"].includes(error.code)) { pending.current = null; setLocked(false); }
        if (["STALE_TASK", "STALE_MATCH"].includes(error.code)) { try { roomCallback.current(await getRoom(session)); } catch { /* Retry keeps the exact receipt. */ } }
      }
      setSubmitError(error instanceof Error ? error.message : "提交未确认，请重试；内容仍在这里");
    } finally { setSubmitting(false); }
  }
  async function reroll() {
    if (rerolling || task.submitted || pending.current || current.current.page.kind !== "opening") return;
    rerollPending.current ??= { id: randomId(), command: { type: "reroll", matchId: game.id, taskId: task.id, sequence: current.current.sequence + 1, page: current.current.page } };
    const request = rerollPending.current; setRerolling(true); setRerollError(null);
    try {
      const room = await sendDrawCommand(session, request.id, request.command);
      const replacement = room.game?.task?.id === task.id ? room.game.task.draft : null;
      if (replacement) {
        current.current = replacement; setDraft(replacement); saved.current = replacement.sequence;
        writeDraft(window.localStorage, key, replacement);
      }
      rerollPending.current = null; roomCallback.current(room);
    } catch (error) {
      setRerollError("换词尚未确认，点击重试；画作仍保留。");
      if (error instanceof ApiError && ["STALE_TASK", "STALE_MATCH", "STALE_DRAFT"].includes(error.code)) {
        try { const room = await getRoom(session); rerollPending.current = null; setRerollError(null); roomCallback.current(room); } catch { /* Keep the receipt for retry. */ }
      } else if (error instanceof ApiError && ["INVALID_PAGE", "INVALID_REQUEST", "INVALID_DRAFT"].includes(error.code)) {
        rerollPending.current = null;
      }
    } finally { setRerolling(false); }
  }
  return { page: draft.page, change, submit, submitting, submitError, reroll, rerolling, rerollError, locked: locked || rerollPending.current !== null };
}
