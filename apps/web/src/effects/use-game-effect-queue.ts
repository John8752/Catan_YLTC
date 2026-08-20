import type { GameView, PublicGameEffectView } from "@catan/protocol";
import { useCallback, useEffect, useRef, useState } from "react";

export function useGameEffectQueue(game: GameView | null): {
  readonly activeEffect: PublicGameEffectView | null;
  readonly completeActiveEffect: () => void;
} {
  const gameIdRef = useRef<string | null>(null);
  const seenRevisionRef = useRef(0);
  const [queue, setQueue] = useState<readonly PublicGameEffectView[]>([]);

  useEffect(() => {
    if (game === null) {
      gameIdRef.current = null;
      seenRevisionRef.current = 0;
      setQueue([]);
      return;
    }

    if (gameIdRef.current !== game.id) {
      gameIdRef.current = game.id;
      seenRevisionRef.current = game.revision;
      setQueue([]);
      return;
    }

    const unseen = game.effects.filter((effect) => effect.revision > seenRevisionRef.current);
    seenRevisionRef.current = Math.max(seenRevisionRef.current, game.revision);
    if (unseen.length === 0) return;

    setQueue((current) => {
      const known = new Set(current.map((effect) => effect.id));
      return [...current, ...unseen.filter((effect) => !known.has(effect.id))];
    });
  }, [game]);

  const completeActiveEffect = useCallback(() => {
    setQueue((current) => current.slice(1));
  }, []);

  return { activeEffect: queue[0] ?? null, completeActiveEffect };
}
