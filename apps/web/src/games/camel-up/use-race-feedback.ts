import { useEffect, useRef, useState } from "react";
import type { CamelGameView } from "@catan/protocol/camel-up";
/** New snapshots establish a baseline; only the next live action gets transient feedback. */
export function useRaceFeedback(game: CamelGameView | null, snapshotEpoch: number) {
  const [effect, setEffect] = useState<CamelGameView["effect"]>(null);
  const seen = useRef<{ id: string; revision: number; epoch: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const previous = seen.current;
    if (!game) { seen.current = null; setEffect(null); return; }
    seen.current = { id: game.id, revision: game.revision, epoch: snapshotEpoch };
    if (!previous || previous.id !== game.id || previous.epoch !== snapshotEpoch || game.revision !== previous.revision + 1) { if (!previous || previous.revision !== game.revision || previous.epoch !== snapshotEpoch) setEffect(null); return; }
    if (timer.current) clearTimeout(timer.current);
    setEffect(game.effect); timer.current = setTimeout(() => setEffect(null), game.effect?.legEnded ? 3400 : 2200);
  }, [game, snapshotEpoch]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return effect;
}
