import type { GameState } from "@catan/game-core";
import type { GameHistoryEntryView } from "./views.js";

export type VictoryWarningTier = 3 | 2 | 1;

export interface VictoryWarningEffectView {
  readonly kind: "victory-warning";
  readonly id: string;
  readonly revision: number;
  readonly playerId: string;
  readonly playerName: string;
  readonly publicPoints: number;
  readonly targetPoints: number;
  readonly tier: VictoryWarningTier;
}

/** Public progress only. Reaching the target does not decide who has won. */
export function victoryWarningTier(publicPoints: number, targetPoints: number): VictoryWarningTier | null {
  const remaining = targetPoints - publicPoints;
  return remaining > 3 ? null : remaining <= 1 ? 1 : remaining === 2 ? 2 : 3;
}

type PublicProgress = Pick<GameState, "id" | "revision" | "phase" | "victoryPointsToWin"> & {
  readonly players: readonly { readonly id: string; readonly name: string; readonly visibleVictoryPoints: number }[];
};

/** Called once after an accepted server transition. No card contents or scoring
 * rules are inspected: the engine's finalized public totals are authoritative.
 * The room retains at most three records per seat for history and deduplication. */
export function collectVictoryWarnings(
  before: PublicProgress,
  after: PublicProgress,
  recorded: readonly VictoryWarningEffectView[],
): readonly VictoryWarningEffectView[] {
  if (before.phase.kind !== "turn" || after.phase.kind !== "turn" || after.revision <= before.revision) return [];
  return after.players.flatMap((player) => {
    const previous = before.players.find((candidate) => candidate.id === player.id);
    if (previous === undefined || player.visibleVictoryPoints <= previous.visibleVictoryPoints) return [];
    const tier = victoryWarningTier(player.visibleVictoryPoints, after.victoryPointsToWin);
    if (tier === null) return [];
    const previousTier = victoryWarningTier(previous.visibleVictoryPoints, after.victoryPointsToWin);
    if (previousTier !== null && tier >= previousTier) return [];
    // A jump consumes every weaker tier too; losing/regaining an award is quiet.
    if (recorded.some((warning) => warning.playerId === player.id && warning.tier <= tier)) return [];
    return [{
      kind: "victory-warning" as const,
      id: `victory-warning:${after.id}:${player.id}:${tier}`,
      revision: after.revision,
      playerId: player.id,
      playerName: player.name,
      publicPoints: player.visibleVictoryPoints,
      targetPoints: after.victoryPointsToWin,
      tier,
    }];
  });
}

export function victoryWarningMessage(warning: VictoryWarningEffectView): string {
  const progress = `${warning.playerName} 公开分数达到 ${warning.publicPoints}/${warning.targetPoints}`;
  return warning.publicPoints >= warning.targetPoints
    ? `${progress}，公开分数已达目标，胜负以回合结算为准`
    : `${progress}，接近获胜（距目标 ${warning.targetPoints - warning.publicPoints} 分）`;
}

export function victoryWarningHistory(warning: VictoryWarningEffectView): GameHistoryEntryView {
  return { revision: warning.revision, type: warning.kind, message: victoryWarningMessage(warning), privateDetail: null };
}
