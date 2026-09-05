import type { GameView, PublicGameEffectView } from "@catan/protocol";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

export function useGameEffectQueue(game: GameView | null, snapshotEpoch = 0): {
  readonly activeEffect: PublicGameEffectView | null;
  readonly completeActiveEffect: () => void;
} {
  const epochRef = useRef(snapshotEpoch);
  const gameIdRef = useRef<string | null>(null);
  const seenRevisionRef = useRef(0);
  const [queue, setQueue] = useState<readonly PublicGameEffectView[]>([]);

  useLayoutEffect(() => {
    if (game === null) {
      gameIdRef.current = null;
      seenRevisionRef.current = 0;
      setQueue([]);
      return;
    }

    if (gameIdRef.current !== game.id || epochRef.current !== snapshotEpoch) {
      epochRef.current = snapshotEpoch;
      gameIdRef.current = game.id;
      seenRevisionRef.current = game.revision;
      setQueue([]);
      return;
    }

    // Current-action notices are immediate and independently deduplicated; a
    // production/trade animation must not delay a five-second roll prompt.
    const unseen = game.effects.filter((effect) => effect.kind !== "action-attention" && effect.kind !== "victory-warning" && effect.revision > seenRevisionRef.current);
    seenRevisionRef.current = Math.max(seenRevisionRef.current, game.revision);
    if (unseen.length === 0) return;

    setQueue((current) => {
      const known = new Set(current.map((effect) => effect.id));
      return [...current, ...unseen.filter((effect) => !known.has(effect.id))];
    });
  }, [game, snapshotEpoch]);

  const completeActiveEffect = useCallback(() => {
    setQueue((current) => current.slice(1));
  }, []);

  return { activeEffect: queue[0] ?? null, completeActiveEffect };
}
