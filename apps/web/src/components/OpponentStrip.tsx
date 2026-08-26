import type { GameView } from "@catan/protocol";
import { cn } from "@/lib/utils.js";
import { PlayerColorDot } from "./PlayerColorDot.js";
import { TurnTimerBadge } from "./TurnTimerBadge.js";

const MAX_VISIBLE_PLAYER_NAME_LENGTH = 6;

export function OpponentStrip({ game }: { readonly game: GameView }) {
  const activePlayerId = game.phase.kind === "turn"
    ? game.phase.activePlayerId
    : game.phase.kind === "setup"
      ? game.phase.placementOrder[game.phase.placementIndex]
      : game.phase.winnerId;
  const opponents = game.players.filter((player) => player.id !== game.you.id);

  return (
    <section className="opponent-strip grid min-w-0 grid-flow-col auto-cols-[minmax(10.5rem,1fr)] gap-1 overflow-x-auto pb-0.5 lg:auto-cols-fr lg:gap-2 lg:overflow-visible lg:pb-0" aria-label="其他玩家">
      {opponents.map((player) => {
        const active = player.id === activePlayerId;
        const timer = game.turnTimer?.playerId === player.id ? game.turnTimer : null;
        return (
          <article
            className={cn(
              "relative min-w-0 overflow-visible rounded-lg border border-white/15 bg-[#173f42]/72 px-1.5 py-1 text-[#fff8df] shadow-sm backdrop-blur-sm lg:rounded-xl lg:px-2.5 lg:py-1.5",
              active && "border-[#f0c56b]/80 bg-[#285d59]/94 ring-1 ring-[#f0c56b]/55",
            )}
            key={player.id}
            data-player-id={player.id}
            data-player-target={player.id}
            aria-label={`${player.name}，${player.visibleVictoryPoints} 分，${player.resourceCardCount} 张资源卡，${player.developmentCardCount} 张发展卡，已出 ${player.playedKnights} 张骑士，最长道路 ${player.longestRoadLength}${active ? "，当前行动" : ""}`}
          >
            <div className="flex min-w-0 items-center gap-1" data-opponent-summary={player.id}>
              <PlayerColorDot color={player.color} className="size-2.5 rounded-sm lg:size-3" />
              <strong className="min-w-0 flex-1 truncate text-[10px] lg:text-sm" title={player.name}>{truncatePlayerName(player.name)}</strong>
              <span className="flex shrink-0 items-center gap-1 text-[8px] font-bold text-[#d7e2da] lg:gap-2 lg:text-[11px]">
                <span title="资源卡">资 {player.resourceCardCount}</span>
                <span title="发展卡">发 {player.developmentCardCount}</span>
                <span
                  className={cn(game.awards.largestArmy.holderId === player.id && "rounded bg-[#f0c56b]/20 px-0.5 text-[#ffe69a]")}
                  title="已出骑士"
                  aria-label={`已出骑士 ${player.playedKnights}`}
                >骑 {player.playedKnights}</span>
                <span
                  className={cn(game.awards.longestRoad.holderId === player.id && "rounded bg-[#f0c56b]/20 px-0.5 text-[#ffe69a]")}
                  title="最长道路长度"
                  aria-label={`最长道路长度 ${player.longestRoadLength}`}
                >长 {player.longestRoadLength}</span>
              </span>
              <b className="grid size-5 shrink-0 place-items-center rounded-full bg-[#f4e4bd] text-[11px] text-[#28433e] lg:size-6 lg:text-xs">{player.visibleVictoryPoints}</b>
            </div>
            <div className="mt-1 grid grid-cols-3 gap-0.5 text-[8px] font-bold text-[#d7e2da] lg:text-[10px]" data-opponent-supply={player.id}>
              <span className="rounded bg-white/8 px-1 py-0.5 text-center" aria-label={`剩余城市 ${player.remainingPieces.cities}`}>城市 <b className="text-[#fff4c9]">{player.remainingPieces.cities}</b></span>
              <span className="rounded bg-white/8 px-1 py-0.5 text-center" aria-label={`剩余村庄 ${player.remainingPieces.settlements}`}>村庄 <b className="text-[#fff4c9]">{player.remainingPieces.settlements}</b></span>
              <span className="rounded bg-white/8 px-1 py-0.5 text-center" aria-label={`剩余道路 ${player.remainingPieces.roads}`}>道路 <b className="text-[#fff4c9]">{player.remainingPieces.roads}</b></span>
            </div>
            {timer === null ? null : (
              <span className="absolute top-[calc(100%+.25rem)] left-0 z-30" data-turn-timer-slot="opponent">
                <TurnTimerBadge timer={timer} className="px-2 py-1 text-xs" />
              </span>
            )}
          </article>
        );
      })}
    </section>
  );
}

function truncatePlayerName(name: string): string {
  const characters = Array.from(name);
  return characters.length <= MAX_VISIBLE_PLAYER_NAME_LENGTH
    ? name
    : `${characters.slice(0, MAX_VISIBLE_PLAYER_NAME_LENGTH).join("")}…`;
}
