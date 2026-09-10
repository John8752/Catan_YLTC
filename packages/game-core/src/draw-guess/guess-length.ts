import type { DrawGuessState, DrawTask } from "./types.js";

export function guessCharacterCount(text: string): number { return [...text.replace(/\s/gu, "")].length; }

/** Only the required length leaves core; the source phrase stays private. */
export function requiredGuessLength(state: DrawGuessState, task: DrawTask): number | null {
  if (task.kind !== "text") return null;
  const source = state.albums[task.albumIndex]?.pages[task.step === 1 ? 0 : task.step - 2]?.content;
  const phrase = source?.kind === "opening" ? source.word : source?.kind === "text" ? source.text : null;
  return phrase === null ? null : guessCharacterCount(phrase);
}
