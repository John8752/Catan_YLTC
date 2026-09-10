import { DrawGuessError, type DrawGuessState, type DrawGuessCommand } from "./types.js";

export function reactToPage(state: DrawGuessState, command: Extract<DrawGuessCommand, { type: "react" }>): DrawGuessState {
  const index = state.albums.findIndex((album) => album.ownerId === command.albumOwnerId);
  const cursor = state.phase.kind === "finished" ? state.players.length ** 2 : state.phase.kind === "reveal" ? state.phase.cursor : 0;
  const page = state.albums[index]?.pages[command.step];
  if (index < 0 || !Number.isInteger(command.step) || command.step < 0 || command.step >= state.players.length
    || index * state.players.length + command.step >= cursor || !page || page.content.kind === "missing"
    || (command.reaction !== "up" && command.reaction !== "down")) throw new DrawGuessError("INVALID_REACTION", "只能评价本局已揭晓的画作或猜词");
  const key = `${index}:${command.step}`;
  const counts = state.reactions[key] ?? { up: 0, down: 0 };
  if (counts[command.reaction] >= Number.MAX_SAFE_INTEGER) throw new DrawGuessError("INVALID_REACTION", "次数已达上限");
  return { ...state, revision: state.revision + 1, reactions: { ...state.reactions, [key]: { ...counts, [command.reaction]: counts[command.reaction] + 1 } } };
}
