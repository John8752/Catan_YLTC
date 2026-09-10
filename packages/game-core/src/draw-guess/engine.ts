import { DrawGuessError, type DrawGuessCommand, type DrawGuessState, type DrawPlayer, type DrawTask, type PageContent } from "./types.js";
import { pageIsEmpty, validatePage } from "./validation.js";
import { wordSuggestions } from "./words.js";

export function createDrawGuess(id: string, players: readonly DrawPlayer[], seed: number): DrawGuessState {
  if (!id || players.length < 3 || players.length > 6 || new Set(players.map((p) => p.id)).size !== players.length || players.some((p) => !p.id || !p.name) || !Number.isInteger(seed)) throw new DrawGuessError("INVALID_PLAYERS", "传画猜词需要 3–6 位不同玩家");
  const suggestions = wordSuggestions(seed, players.length);
  return { id, revision: 0, players: players.map((p) => ({ ...p })), suggestions: Object.fromEntries(players.map((p, i) => [p.id, suggestions[i]!])),
    phase: { kind: "work", step: 0 }, albums: players.map((p) => ({ ownerId: p.id, pages: [] })), drafts: {} };
}
export function taskFor(state: DrawGuessState, playerId: string): DrawTask | null {
  const index = state.players.findIndex((p) => p.id === playerId);
  if (index < 0 || state.phase.kind !== "work") return null;
  const step = state.phase.step;
  const albumIndex = (index - step + state.players.length) % state.players.length;
  return { id: `${state.id}:${step}:${playerId}`, step, albumIndex, kind: step === 0 ? "opening" : step % 2 ? "text" : "drawing", submitted: state.albums[albumIndex]!.pages.length > step };
}
function commit(state: DrawGuessState, task: DrawTask, authorId: string, content: PageContent, timedOut: boolean): DrawGuessState {
  const albums = state.albums.map((album, i) => i === task.albumIndex ? { ...album, pages: [...album.pages, { authorId, step: task.step, timedOut, content }] } : album);
  const complete = albums.every((album) => album.pages.length > task.step);
  const drafts = { ...state.drafts }; delete drafts[authorId];
  return { ...state, albums, drafts: complete ? {} : drafts,
    phase: complete ? (task.step + 1 === state.players.length ? { kind: "reveal", cursor: 0 } : { kind: "work", step: task.step + 1 }) : state.phase };
}
export function executeDrawGuess(state: DrawGuessState, actorId: string | null, command: DrawGuessCommand): DrawGuessState {
  if (!["draft", "submit", "expire", "reveal"].includes(command.type)) throw new DrawGuessError("INVALID_COMMAND", "未知操作");
  if (command.matchId !== state.id) throw new DrawGuessError("STALE_MATCH", "这条操作属于上一局，请刷新当前对局");
  if (command.type === "expire") {
    if (actorId !== null || state.phase.kind !== "work" || state.phase.step !== command.step) throw new DrawGuessError("STALE_TASK", "这个阶段已结束");
    let next = state;
    for (const player of state.players) {
      const task = taskFor(next, player.id);
      if (!task || task.submitted) continue;
      const draft = next.drafts[player.id]?.page;
      next = commit(next, task, player.id, draft && !pageIsEmpty(draft) ? draft : { kind: "missing", expected: task.kind }, true);
    }
    return { ...next, revision: state.revision + 1 };
  }
  if (command.type === "reveal") {
    if (actorId !== null) throw new DrawGuessError("SERVER_ONLY", "揭晓由系统主持人自动进行");
    if (state.phase.kind !== "reveal" || state.phase.cursor !== command.expectedCursor) throw new DrawGuessError("STALE_REVEAL", "这一页已经揭晓");
    const cursor = state.phase.cursor + 1;
    return { ...state, revision: state.revision + 1, phase: cursor > state.players.length ** 2 ? { kind: "finished" } : { kind: "reveal", cursor } };
  }
  if (!actorId || !state.players.some((p) => p.id === actorId)) throw new DrawGuessError("INVALID_PLAYER", "你不在本局玩家名单中");
  const task = taskFor(state, actorId);
  if (!task || task.id !== command.taskId || task.submitted) throw new DrawGuessError("STALE_TASK", "任务已提交或已进入下一轮");
  const page = validatePage(command.page, task.kind, command.type === "draft");
  if (page.kind === "opening" && page.word !== "" && !state.suggestions[actorId]!.includes(page.word)) throw new DrawGuessError("INVALID_PAGE", "请从本轮的六个词语中选择一个");
  if (command.type === "draft") {
    if (!Number.isSafeInteger(command.sequence) || command.sequence < 1) throw new DrawGuessError("INVALID_DRAFT", "草稿序号无效");
    if (command.sequence <= (state.drafts[actorId]?.sequence ?? 0)) return state;
    return { ...state, revision: state.revision + 1, drafts: { ...state.drafts, [actorId]: { sequence: command.sequence, page } } };
  }
  return { ...commit(state, task, actorId, page, false), revision: state.revision + 1 };
}
