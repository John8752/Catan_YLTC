import type { PublicPlayerView } from "@catan/protocol";
import { cn } from "@/lib/utils.js";

/** All seats show the same server-projected public score, never private cards. */
export function PlayerScoreBadge({ player, className }: {
  readonly player: Pick<PublicPlayerView, "id" | "name" | "visibleVictoryPoints">;
  readonly className?: string;
}) {
  return (
    <b
      className={cn("grid size-5 shrink-0 place-items-center rounded-full bg-[#f4e4bd] text-[11px] text-[#28433e] ring-1 ring-[#6d5434]/15 lg:size-6 lg:text-base", className)}
      data-player-score={player.id}
      aria-label={`${player.name}，公开分数 ${player.visibleVictoryPoints} 分`}
      title="公开分数，不含隐藏胜利点"
    >
      {player.visibleVictoryPoints}
    </b>
  );
}
