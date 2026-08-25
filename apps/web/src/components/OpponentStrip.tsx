import type { GameView } from "@catan/protocol";
import { Route, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils.js";

const PLAYER_COLORS = {
  terracotta: "bg-[#c85d42]",
  ocean: "bg-[#3886a5]",
  pine: "bg-[#3f8057]",
  wheat: "bg-[#d2a534]",
  plum: "bg-[#81577d]",
  charcoal: "bg-[#48504f]",
} as const;

export function OpponentStrip({ game }: { readonly game: GameView }) {
  const activePlayerId = game.phase.kind === "turn"
    ? game.phase.activePlayerId
    : game.phase.kind === "setup"
      ? game.phase.placementOrder[game.phase.placementIndex]
      : game.phase.winnerId;
  const opponents = game.players.filter((player) => player.id !== game.you.id);

  return (
    <section className="opponent-strip grid min-w-0 grid-flow-col auto-cols-fr gap-1 lg:gap-2" aria-label="其他玩家">
      {opponents.map((player) => {
        const active = player.id === activePlayerId;
        return (
          <article
            className={cn(
              "relative min-w-0 overflow-hidden rounded-lg border border-white/15 bg-[#173f42]/72 px-1.5 py-1 text-[#fff8df] shadow-sm backdrop-blur-sm lg:rounded-xl lg:px-2.5 lg:py-1.5",
              active && "border-[#f0c56b]/80 bg-[#285d59]/94 ring-1 ring-[#f0c56b]/55",
            )}
            key={player.id}
            data-player-id={player.id}
            data-player-target={player.id}
            aria-label={`${player.name}，${player.visibleVictoryPoints} 分，${player.resourceCardCount} 张资源卡，${player.developmentCardCount} 张发展卡${active ? "，当前行动" : ""}`}
          >
            <div className="flex min-w-0 items-center gap-1">
              <span className={cn("size-2.5 shrink-0 rounded-sm ring-1 ring-white/65 lg:size-3", PLAYER_COLORS[player.color])} aria-hidden="true" />
              <strong className="min-w-0 flex-1 truncate text-[11px] lg:text-sm" title={player.name}>{player.name}</strong>
              <b className="grid size-5 shrink-0 place-items-center rounded-full bg-[#f4e4bd] text-[11px] text-[#28433e] lg:size-6 lg:text-xs">{player.visibleVictoryPoints}</b>
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[9px] font-bold text-[#d7e2da] lg:gap-2 lg:text-[11px]">
              <span title="资源卡">资 {player.resourceCardCount}</span>
              <span title="发展卡">发 {player.developmentCardCount}</span>
              <span className="ml-auto flex gap-0.5 [&_svg]:size-3">
                {game.awards.longestRoad.holderId === player.id ? <Route aria-label="最长道路" /> : null}
                {game.awards.largestArmy.holderId === player.id ? <ShieldCheck aria-label="最大骑士力" /> : null}
              </span>
            </div>
            {active ? <span className="absolute right-1 bottom-0.5 text-[8px] font-black tracking-wide text-[#ffd980] lg:static lg:mt-0.5 lg:block lg:text-[9px]">行动中</span> : null}
          </article>
        );
      })}
    </section>
  );
}
