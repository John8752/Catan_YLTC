import type { GameView } from "@catan/protocol";
import { useEffect, useRef, useState } from "react";
import { createGameAudio } from "./game-audio.js";

const SOUND_SETTING = "catan-yltc-sound";
function readEnabled() {
  try { return localStorage.getItem(SOUND_SETTING) !== "off"; } catch { return true; }
}

export function useGameSounds(game: GameView | null, snapshotEpoch: number, live: boolean) {
  const [audio] = useState(createGameAudio);
  const [enabled, setEnabled] = useState(readEnabled);
  const baseline = useRef({ identity: "", epoch: -1, revision: 0, turns: new Set<string>() });

  useEffect(() => {
    const unlock = () => audio.unlock();
    document.addEventListener("pointerup", unlock);
    document.addEventListener("keydown", unlock);
    return () => {
      document.removeEventListener("pointerup", unlock);
      document.removeEventListener("keydown", unlock);
      audio.dispose();
    };
  }, [audio]);

  useEffect(() => { audio.setMuted(!enabled); }, [audio, enabled]);

  useEffect(() => {
    const identity = game === null ? "" : `${game.id}:${game.you.id}`;
    const currentTurn = game?.effects.find((effect) => effect.kind === "action-attention" && effect.sound === "your-turn");
    const previous = baseline.current;
    if (identity !== previous.identity || snapshotEpoch !== previous.epoch || !live) {
      const turns = identity === previous.identity ? previous.turns : new Set<string>();
      if (currentTurn) turns.add(currentTurn.id);
      baseline.current = { identity, epoch: snapshotEpoch, revision: game?.revision ?? 0, turns };
      return;
    }
    if (game === null || game.revision < previous.revision) return;
    // Audio has an immediate lane; resource travel cannot delay roll feedback.
    if (game.effects.some((effect) => effect.kind === "dice-roll" && effect.revision > previous.revision)) audio.play("dice-roll");
    previous.revision = game.revision;
    if (currentTurn && !previous.turns.has(currentTurn.id)) {
      previous.turns.add(currentTurn.id);
      audio.play("your-turn");
    }
  }, [audio, game, snapshotEpoch, live]);

  return { enabled, toggle: () => {
    const next = !enabled;
    audio.setMuted(!next);
    if (next) audio.unlock();
    setEnabled(next);
    try { localStorage.setItem(SOUND_SETTING, next ? "on" : "off"); } catch { /* Preference remains usable for this page. */ }
  } };
}
