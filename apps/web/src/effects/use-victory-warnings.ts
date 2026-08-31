import type { GameView, VictoryWarningEffectView } from "@catan/protocol";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export const VICTORY_WARNING_DURATION_MS = 3_000;

export function useVictoryWarnings(game: GameView | null, snapshotEpoch: number, live: boolean, actionNoticeVisible: boolean) {
  const baseline = useRef({ identity: "", epoch: -1, revision: 0, seen: new Set<string>() });
  const [queue, setQueue] = useState<readonly VictoryWarningEffectView[]>([]);

  useLayoutEffect(() => {
    const identity = game === null ? "" : `${game.id}:${game.you.id}`;
    const warnings = game?.effects.filter((effect): effect is VictoryWarningEffectView => effect.kind === "victory-warning") ?? [];
    const previous = baseline.current;
    if (identity !== previous.identity || snapshotEpoch !== previous.epoch || !live || game?.phase.kind !== "turn") {
      baseline.current = { identity, epoch: snapshotEpoch, revision: game?.revision ?? 0, seen: new Set(warnings.map((warning) => warning.id)) };
      setQueue([]);
      return;
    }
    if (game.revision < previous.revision) return;
    const unseen = warnings.filter((warning) => warning.revision > previous.revision && warning.revision <= game.revision && !previous.seen.has(warning.id));
    previous.revision = game.revision;
    unseen.forEach((warning) => previous.seen.add(warning.id));
    setQueue((current) => {
      const candidates = [...current, ...unseen].filter((warning) => {
        const player = game.players.find((candidate) => candidate.id === warning.playerId);
        return player !== undefined && player.visibleVictoryPoints >= warning.publicPoints;
      });
      // Upgrade one player's pending notice instead of playing weaker tiers first.
      return candidates.filter((warning) => !candidates.some((other) => other.playerId === warning.playerId && other.tier < warning.tier));
    });
  }, [game, snapshotEpoch, live]);

  const notice = actionNoticeVisible ? null : queue[0] ?? null;
  useEffect(() => {
    if (notice === null) return;
    const timer = window.setTimeout(() => setQueue((current) => current.filter((warning) => warning.id !== notice.id)), VICTORY_WARNING_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [notice?.id]);

  return notice;
}
