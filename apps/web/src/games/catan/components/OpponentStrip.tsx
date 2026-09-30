import type { GameView } from "@catan/protocol/catan";
import { cn } from "../../../lib/utils.js";
import { PlayerColorDot } from "./PlayerColorDot.js";
import { PlayerScoreBadge } from "./PlayerScoreBadge.js";
import { TurnTimerBadge } from "./TurnTimerBadge.js";
import { PlayerDetails } from "./PlayerDetails.js";

const MAX_VISIBLE_PLAYER_NAME_LENGTH = 6;

export function OpponentStrip({ game }: { readonly game: GameView }) {
  const activePlayerId = game.phase.kind === "turn"
    ? game.phase.activePlayerId
    : game.phase.kind === "setup"
      ? game.phase.placementOrder[game.phase.placementIndex]
      : game.phase.winnerId;
  // Everyone, in seat order, so the column reads as the turn order rather than as
  // "the other people". The local seat keeps its detail in the dock, so this row
  // carries no `data-player-target`: that anchor has to stay unique for the
  // resource-flight animation.
  const seats = game.players;
  // Who acts after the current opportunity, from the server-projected queue. In
  // five/six-seat games that can be a paired action rather than the next seat.
  const next = game.phase.kind === "turn" ? game.turnQueue[1] : undefined;

  return (
    <section className="opponent-strip col-start-1 row-start-1 grid min-w-0 shrink-0 grid-flow-col auto-cols-[minmax(0,1fr)] gap-1 overflow-x-auto pb-0.5 phone-landscape:col-span-2 lg:auto-cols-[14rem] xl:min-h-0 xl:shrink xl:auto-rows-max xl:grid-flow-row xl:grid-cols-1 xl:auto-cols-auto xl:content-start xl:gap-0 xl:overflow-x-hidden xl:overflow-y-auto xl:rounded-xl xl:bg-[var(--game-rail-bg)] xl:pb-0 xl:ring-1 xl:ring-inset xl:ring-[var(--game-rail-line)]" aria-label="座位顺序" tabIndex={0}>
      {seats.map((player) => {
        const active = player.id === activePlayerId;
        const self = player.id === game.you.id;
        const timer = game.turnTimer?.playerId === player.id ? game.turnTimer : null;
        const upNext = next !== undefined && next.playerId === player.id && !active;
        return (
          <article
            className={cn(
              "relative min-w-0 overflow-visible rounded-lg border border-white/15 bg-[#173f42]/72 px-1 py-1 text-[#fff8df] shadow-sm backdrop-blur-sm lg:rounded-xl lg:px-2.5 lg:py-1.5 xl:rounded-none xl:border-transparent xl:border-b-[var(--game-rail-line)] xl:bg-transparent xl:text-[var(--game-rail-ink)] xl:shadow-none xl:backdrop-blur-none xl:first:rounded-t-xl",
              // Phones share one row equally between every seat, so the strip reads
              // as the whole order. The 1024-1279px strip keeps wide cards that
              // scroll sideways; there the dock beside it already shows this seat.
              self && "border-[#f2b3aa]/55 lg:max-xl:hidden xl:border-b-[var(--game-rail-line)]",
              upNext && "border-dashed border-[#f0c56b]/70",
              active && "border-[#f0c56b]/80 bg-[#285d59]/94 ring-1 ring-[#f0c56b]/55 xl:bg-[#304b43] xl:ring-inset xl:ring-[#6b8270]",
            )}
            key={player.id}
            data-seat-of={player.id}
            data-seat-active={active || undefined}
            data-seat-next={upNext ? next.kind : undefined}
            {...(self ? { "data-seat-self": "true" } : { "data-player-id": player.id, "data-player-target": player.id })}
            aria-label={`${self ? "你，" : ""}${player.name}，${player.visibleVictoryPoints} 分，${player.resourceCardCount} 张资源卡，${player.developmentCardCount} 张发展卡，已出 ${player.playedKnights} 张骑士，最长道路 ${player.longestRoadLength}${active ? "，当前行动" : ""}${upNext ? `，下一位行动${next.kind === "paired" ? "（搭档行动）" : ""}` : ""}`}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-x-1 lg:gap-x-2" data-opponent-summary={player.id}>
              <PlayerColorDot color={player.color} className="size-2.5 rounded-sm lg:size-3" />
              <PlayerDetails player={player}><button type="button" className="min-w-0 flex-1 truncate py-0.5 text-left text-[11px] font-bold outline-offset-2 lg:py-1 lg:text-base" aria-label={`查看${player.name}的玩家详情`} title={player.name}>
              <strong>
                <span className="lg:hidden">{self ? "你" : phoneName(player.name, seats.length)}</span>
                <span className="max-lg:hidden">{truncatePlayerName(player.name)}</span>
                {self ? <span className="ml-1 rounded bg-white/20 px-1 text-[8px] align-middle max-lg:hidden lg:text-[10px]">你</span> : null}
              </strong></button></PlayerDetails>
              {/* Phones stack name over counts so six seats fit one row. */}
              <span className="basis-full lg:hidden" aria-hidden="true" />
              <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-[#d7e2da] lg:order-3 lg:mt-1 lg:grid lg:w-full lg:grid-cols-4 lg:gap-1 lg:text-sm xl:text-[var(--game-rail-muted)]">
                <span title="资源卡">资<span className="lg:ml-1">{player.resourceCardCount}</span></span>
                <span title="发展卡" className="hidden lg:inline">发 {player.developmentCardCount}</span>
                <span
                  className={cn("hidden lg:inline", game.awards.largestArmy.holderId === player.id && "rounded bg-[#f0c56b]/20 px-0.5 text-[#ffe69a] xl:bg-[#d1b793]/10 xl:text-[var(--game-rail-accent)]")}
                  title="已出骑士"
                  aria-label={`已出骑士 ${player.playedKnights}`}
                >骑 {player.playedKnights}</span>
                <span
                  className={cn("hidden lg:inline", game.awards.longestRoad.holderId === player.id && "rounded bg-[#f0c56b]/20 px-0.5 text-[#ffe69a] xl:bg-[#d1b793]/10 xl:text-[var(--game-rail-accent)]")}
                  title="最长道路长度"
                  aria-label={`最长道路长度 ${player.longestRoadLength}`}
                >长 {player.longestRoadLength}</span>
              </span>
              <PlayerScoreBadge player={player} victoryPointsToWin={game.victoryPointsToWin} active={game.phase.kind === "turn"} />
              {timer === null ? null : <TurnTimerBadge timer={timer} className="ml-0.5" />}
            </div>
            <div className="mt-1 hidden grid-cols-3 gap-0.5 font-bold text-[#d7e2da] lg:grid lg:text-xs xl:text-[var(--game-rail-muted)] xl:[&>span]:bg-white/5 xl:[&_b]:text-[var(--game-rail-ink)]" data-opponent-supply={player.id}>
              <span className="rounded bg-white/8 px-1 py-0.5 text-center" aria-label={`剩余城市 ${player.remainingPieces.cities}`}>城市 <b className="text-[#fff4c9]">{player.remainingPieces.cities}</b></span>
              <span className="rounded bg-white/8 px-1 py-0.5 text-center" aria-label={`剩余村庄 ${player.remainingPieces.settlements}`}>村庄 <b className="text-[#fff4c9]">{player.remainingPieces.settlements}</b></span>
              <span className="rounded bg-white/8 px-1 py-0.5 text-center" aria-label={`剩余道路 ${player.remainingPieces.roads}`}>道路 <b className="text-[#fff4c9]">{player.remainingPieces.roads}</b></span>
            </div>
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

/**
 * Five or six seats share a phone row at about 3.5rem each, where an ellipsis
 * would take the place of a second character. Keep two whole characters instead;
 * the full name stays in the title and the player-details dialog.
 */
function phoneName(name: string, seatCount: number): string {
  return seatCount > 4 ? Array.from(name).slice(0, 2).join("") : name;
}
