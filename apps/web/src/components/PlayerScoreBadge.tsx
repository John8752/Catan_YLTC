import { victoryWarningTier, type PublicPlayerView } from "@catan/protocol";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils.js";

/** All seats show the same server-projected public score, never private cards. */
export function PlayerScoreBadge({ player, victoryPointsToWin, active, className }: {
  readonly player: Pick<PublicPlayerView, "id" | "name" | "visibleVictoryPoints">;
  readonly victoryPointsToWin: number;
  readonly active: boolean;
  readonly className?: string;
}) {
  const tier = active ? victoryWarningTier(player.visibleVictoryPoints, victoryPointsToWin) : null;
  const progress = player.visibleVictoryPoints >= victoryPointsToWin ? "公开分数已达目标，胜负以回合结算为准" : `接近获胜，公开分数距目标 ${victoryPointsToWin - player.visibleVictoryPoints} 分`;
  return (
    <b
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full bg-[#f4e4bd] text-[11px] text-[#28433e] ring-1 ring-[#6d5434]/15 lg:size-6 lg:text-base",
        tier !== null && "flex w-auto gap-0.5 bg-[#fff0c2] px-1.5 text-[#70450c] ring-[#d3a346] lg:w-auto lg:gap-1 lg:px-2",
        tier === 2 && "bg-[#ffe3a0] ring-[#be861e]",
        tier === 1 && "bg-[#ffd37b] ring-2 ring-[#9e650f]",
        className,
      )}
      data-player-score={player.id}
      data-victory-proximity={tier ?? undefined}
      aria-label={`${player.name}，公开分数 ${player.visibleVictoryPoints} 分${tier === null ? "" : `，目标 ${victoryPointsToWin} 分，${progress}`}`}
      title={`公开分数，不含隐藏胜利点${tier === null ? "" : `；${progress}`}`}
    >
      {tier === null ? player.visibleVictoryPoints : <><Trophy className="size-3 shrink-0 lg:size-3.5" aria-hidden="true" /><span className="tabular-nums">{player.visibleVictoryPoints}/{victoryPointsToWin}</span></>}
    </b>
  );
}
