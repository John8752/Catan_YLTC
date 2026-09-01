import { victoryWarningTier, type GameView } from "@catan/protocol";
import { cn } from "@/lib/utils.js";
import { PlayerColorDot } from "./PlayerColorDot.js";
import { PlayerScoreBadge } from "./PlayerScoreBadge.js";

const MAX_VISIBLE_PLAYER_NAME_LENGTH = 6;

export function OpponentStrip({ game }: { readonly game: GameView }) {
  const activePlayerId = game.phase.kind === "turn"
    ? game.phase.activePlayerId
    : game.phase.kind === "setup"
      ? game.phase.placementOrder[game.phase.placementIndex]
      : game.phase.winnerId;
  const opponents = game.players.filter((player) => player.id !== game.you.id);

  return (
    <section className="opponent-strip col-start-1 row-start-1 grid min-w-0 shrink-0 grid-flow-col auto-cols-[minmax(10.5rem,1fr)] gap-1 overflow-x-auto pb-0.5 phone-landscape:col-span-2 lg:auto-cols-[14rem] xl:min-h-0 xl:shrink xl:auto-rows-max xl:grid-flow-row xl:grid-cols-1 xl:auto-cols-auto xl:content-start xl:gap-0 xl:overflow-x-hidden xl:overflow-y-auto xl:rounded-xl xl:bg-[var(--game-rail-bg)] xl:pb-0 xl:ring-1 xl:ring-inset xl:ring-[var(--game-rail-line)]" aria-label="其他玩家" tabIndex={0}>
      {opponents.map((player) => {
        const active = player.id === activePlayerId;
        const nearVictory = game.phase.kind === "turn" && victoryWarningTier(player.visibleVictoryPoints, game.victoryPointsToWin) !== null;
        return (
          <article
            className={cn(
              "relative min-w-0 overflow-visible rounded-lg border border-white/15 bg-[#173f42]/72 px-1.5 py-1 text-[#fff8df] shadow-sm backdrop-blur-sm lg:rounded-xl lg:px-2.5 lg:py-1.5 xl:rounded-none xl:border-transparent xl:border-b-[var(--game-rail-line)] xl:bg-transparent xl:text-[var(--game-rail-ink)] xl:shadow-none xl:backdrop-blur-none xl:first:rounded-t-xl",
              active && "border-[#f0c56b]/80 bg-[#285d59]/94 ring-1 ring-[#f0c56b]/55 xl:bg-[#304b43] xl:ring-inset xl:ring-[#6b8270]",
            )}
            key={player.id}
            data-player-id={player.id}
            data-player-target={player.id}
            aria-label={`${player.name}，${player.visibleVictoryPoints} 分，${player.resourceCardCount} 张资源卡，${player.developmentCardCount} 张发展卡，已出 ${player.playedKnights} 张骑士，最长道路 ${player.longestRoadLength}${active ? "，当前行动" : ""}`}
          >
            <div className={cn("flex min-w-0 items-center gap-1 lg:flex-wrap lg:gap-x-2", nearVictory && "flex-wrap")} data-opponent-summary={player.id}>
              <PlayerColorDot color={player.color} className="size-2.5 rounded-sm lg:size-3" />
              <strong className="min-w-0 flex-1 truncate text-[10px] lg:text-base" title={player.name}>{truncatePlayerName(player.name)}</strong>
              <span className={cn("flex shrink-0 items-center gap-1 text-[8px] font-bold text-[#d7e2da] lg:order-3 lg:mt-1 lg:grid lg:w-full lg:grid-cols-4 lg:gap-1 lg:text-sm xl:text-[var(--game-rail-muted)]", nearVictory && "order-3 grid w-full grid-cols-4")}>
                <span title="资源卡">资 {player.resourceCardCount}</span>
                <span title="发展卡">发 {player.developmentCardCount}</span>
                <span
                  className={cn(game.awards.largestArmy.holderId === player.id && "rounded bg-[#f0c56b]/20 px-0.5 text-[#ffe69a] xl:bg-[#d1b793]/10 xl:text-[var(--game-rail-accent)]")}
                  title="已出骑士"
                  aria-label={`已出骑士 ${player.playedKnights}`}
                >骑 {player.playedKnights}</span>
                <span
                  className={cn(game.awards.longestRoad.holderId === player.id && "rounded bg-[#f0c56b]/20 px-0.5 text-[#ffe69a] xl:bg-[#d1b793]/10 xl:text-[var(--game-rail-accent)]")}
                  title="最长道路长度"
                  aria-label={`最长道路长度 ${player.longestRoadLength}`}
                >长 {player.longestRoadLength}</span>
              </span>
              <PlayerScoreBadge player={player} victoryPointsToWin={game.victoryPointsToWin} active={game.phase.kind === "turn"} />
            </div>
            <div className="mt-1 grid grid-cols-3 gap-0.5 text-[8px] font-bold text-[#d7e2da] lg:text-xs xl:text-[var(--game-rail-muted)] xl:[&>span]:bg-white/5 xl:[&_b]:text-[var(--game-rail-ink)]" data-opponent-supply={player.id}>
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
