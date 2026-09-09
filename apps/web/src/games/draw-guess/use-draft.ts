import { useEffect, useRef, useState } from "react";
import type { Draft, EditablePage, DrawGuessPlayerCommand } from "@catan/game-core/draw-guess";
import type { DrawGuessRoomView, DrawGuessView } from "@catan/protocol/draw-guess";
import { ApiError, getRoom, type PlayerSession } from "../../api.js";
import type { AnyRoomView } from "@catan/protocol";
import { randomId } from "../../lib/random-id.js";
import { draftKey, readDraft, writeDraft, removeDraft, pruneDrafts } from "./drafts.js";
import { sendDrawCommand } from "./api.js";

/** Mounted with key=task.id. Each request remains scoped to that seat/match/task. */
export function useDraft(session: PlayerSession, game: DrawGuessView, task: NonNullable<DrawGuessView["task"]>, onRoom: (room: AnyRoomView) => void) {
  const key = draftKey(session, game.id, task.id);
  const [draft, setDraft] = useState<Draft>(() => {
    const local = readDraft(window.localStorage, key, task.kind); const remote = task.draft;
    return (local && local.sequence > (remote?.sequence ?? 0) ? local : remote) ?? { sequence: 0, page: task.kind === "text" ? { kind: "text", text: "" } : { kind: "drawing", strokes: [] } };
  });
  const current = useRef(draft); current.current = draft;
  const saved = useRef(task.draft?.sequence ?? 0);
  const roomCallback = useRef(onRoom); roomCallback.current = onRoom;
  const [saveStatus, setSaveStatus] = useState("草稿只对你可见");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pending = useRef<{ readonly id: string; readonly command: DrawGuessPlayerCommand } | null>(null);
  const [locked, setLocked] = useState(false);
  const finished = useRef(task.submitted); finished.current = task.submitted;
  useEffect(() => { pruneDrafts(window.localStorage); }, []);
  useEffect(() => {
    if (!task.submitted) return;
    removeDraft(window.localStorage, key); pending.current = null;
  }, [task.submitted, key]);
  useEffect(() => {
    if (task.draft && task.draft.sequence > current.current.sequence && !pending.current) {
      current.current = task.draft; setDraft(task.draft); saved.current = task.draft.sequence;
    }
  }, [task.draft]);
  useEffect(() => {
    if (task.submitted || draft.sequence === 0) return;
    const timer = setTimeout(() => { if (!writeDraft(window.localStorage, key, draft)) setSaveStatus("设备存储不可用，仍会保存到服务器"); }, 200);
    return () => clearTimeout(timer);
  }, [draft, key, task.submitted]);
  useEffect(() => {
    let active = true; let inFlight = false;
    const saveLocal = () => { if (!finished.current && current.current.sequence > 0) writeDraft(window.localStorage, key, current.current); };
    const checkpoint = async () => {
      const copy = current.current;
      if (!active || inFlight || finished.current || pending.current || copy.sequence <= saved.current) return;
      inFlight = true; setSaveStatus("正在保存草稿…");
      try {
        const room: DrawGuessRoomView = await sendDrawCommand(session, randomId(), { type: "draft", matchId: game.id, taskId: task.id, sequence: copy.sequence, page: copy.page });
        if (active) { saved.current = Math.max(saved.current, copy.sequence); setSaveStatus("草稿已保存，仅你可见"); roomCallback.current(room); }
      } catch (error) {
        if (active) {
          setSaveStatus("草稿保留在本机，联网后自动重试");
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
    if (task.submitted || pending.current) return;
    const next = { sequence: current.current.sequence + 1, page }; current.current = next; setDraft(next); setSaveStatus("草稿待保存");
  }
  async function submit() {
    if (submitting || task.submitted) return;
    pending.current ??= { id: randomId(), command: { type: "submit", matchId: game.id, taskId: task.id, page: current.current.page } };
    const request = pending.current; setLocked(true); setSubmitting(true); setSubmitError(null);
    try { const room = await sendDrawCommand(session, request.id, request.command); finished.current = true; removeDraft(window.localStorage, key); roomCallback.current(room); }
    catch (error) {
      if (error instanceof ApiError) {
        // Definite rejection means this content was not accepted; permit editing after validation errors.
        if (error.code === "INVALID_PAGE" || error.code === "INVALID_REQUEST") { pending.current = null; setLocked(false); }
        if (["STALE_TASK", "STALE_MATCH"].includes(error.code)) { try { roomCallback.current(await getRoom(session)); } catch { /* Retry keeps the exact receipt. */ } }
      }
      setSubmitError(error instanceof Error ? error.message : "提交未确认，请重试；内容仍在这里");
    } finally { setSubmitting(false); }
  }
  return { page: draft.page, change, saveStatus, submit, submitting, submitError, locked };
}
