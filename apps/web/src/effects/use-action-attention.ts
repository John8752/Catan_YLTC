import type { ActionAttentionEffectView, GameView } from "@catan/protocol";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export const ATTENTION_DURATION_MS = 1_500;

export function useActionAttention(game: GameView | null, snapshotEpoch: number, live: boolean) {
  const baseline = useRef({ game: "", epoch: -1, revision: 0, seen: new Set<string>() });
  const [notice, setNotice] = useState<ActionAttentionEffectView | null>(null);

  useLayoutEffect(() => {
    const identity = game === null ? "" : `${game.id}:${game.you.id}`;
    const current = game?.effects.find((effect): effect is ActionAttentionEffectView => effect.kind === "action-attention");
    const previous = baseline.current;
    if (identity !== previous.game || snapshotEpoch !== previous.epoch || !live) {
      const seen = identity === previous.game ? previous.seen : new Set<string>();
      if (current) seen.add(current.id);
      baseline.current = { game: identity, epoch: snapshotEpoch, revision: game?.revision ?? 0, seen };
      setNotice(null);
      return;
    }
    if (game === null || game.revision < previous.revision) return;
    previous.revision = game.revision;
    if (current === undefined) { setNotice(null); return; }
    if (previous.seen.has(current.id)) {
      // A resolved forced action can return to an already-notified turn.
      setNotice((visible) => visible?.id === current.id ? visible : null);
      return;
    }
    previous.seen.add(current.id);
    setNotice(current);
  }, [game, snapshotEpoch, live]);

  useEffect(() => {
    if (notice === null) return;
    const timer = window.setTimeout(() => setNotice(null), ATTENTION_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return notice;
}
