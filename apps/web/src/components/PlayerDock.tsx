import { RESOURCE_TYPES, type ResourceHand, type ResourceType } from "@catan/game-core";
import { describeAction, victoryWarningTier, type GameCommand, type GameView } from "@catan/protocol";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card.js";
import { GameControls } from "./GameControls.js";
import { DockActions } from "./DockActions.js";
import { ResourceCard, resourceLabel } from "./ResourceCard.js";
import { emptyResourceSelection, incrementResource } from "./ResourceCardPicker.js";
import { PlayerPublicStats } from "./PlayerPublicStats.js";
import { PlayerColorDot } from "./PlayerColorDot.js";
import { PlayerScoreBadge } from "./PlayerScoreBadge.js";
import { TurnTimerBadge } from "./TurnTimerBadge.js";
import { cn } from "@/lib/utils.js";

export interface PlayerDockProps {
  readonly game: GameView;
  readonly compact?: boolean;
  readonly busy: boolean;
  readonly onCommand: (command: GameCommand) => void;
  readonly buildMode: "road" | "settlement" | "city" | null;
  readonly selectedRobberHexId: string | null;
  readonly onBuildModeChange: (mode: "road" | "settlement" | "city" | null) => void;
}

export function PlayerDock({
  game,
  compact = false,
  busy,
  onCommand,
  buildMode,
  selectedRobberHexId,
  onBuildModeChange,
}: PlayerDockProps) {
  const [discardSelection, setDiscardSelection] = useState<ResourceHand>(emptyResourceSelection);

  useEffect(() => {
    if (game.interaction.kind !== "discard") setDiscardSelection(emptyResourceSelection());
  }, [game.interaction.kind]);

  const activeSelection = game.interaction.kind === "discard" ? discardSelection : null;
  const activeSelectionLabel = "准备弃掉";
  const prompt = describeAction(game.interaction);
  const nearVictory = game.phase.kind === "turn" && victoryWarningTier(game.you.visibleVictoryPoints, game.victoryPointsToWin) !== null;

  const addFromHand = (resource: ResourceType) => {
    if (activeSelection === null) return;
    const next = incrementResource(activeSelection, resource, game.you.resources[resource]);
    setDiscardSelection(next);
  };

  return (
    <Card data-player-dock="true" data-action-attention={prompt?.tone ?? "none"} className={cn(
      "player-dock relative col-start-1 row-start-3 min-h-0 gap-0 overflow-visible border-white/20 bg-[#f3e6c8]/96 p-2 shadow-2xl backdrop-blur-sm phone-landscape:col-start-2 phone-landscape:row-start-2 phone-landscape:overflow-y-auto lg:mt-auto lg:shrink-0 lg:p-1.5 lg:text-[var(--game-rail-ink)] lg:shadow-none lg:backdrop-blur-none",
      prompt?.tone !== "required" && "lg:rounded-none lg:border-transparent lg:bg-transparent",
      prompt?.tone === "required" && "border-[#e49c96] bg-[#fce5e3] ring-2 ring-[#e49c96]/65 lg:border-[#e49c96]/30 lg:bg-[#303c39] lg:ring-1 lg:ring-inset lg:ring-[#e49c96]/15",
      prompt?.tone === "trade" && "border-[#a9c7c0] ring-1 ring-[#a9c7c0]/40",
    )}>
      <div className={cn("grid grid-cols-[minmax(112px,.26fr)_minmax(0,1fr)] items-stretch gap-2 phone-landscape:flex phone-landscape:flex-col md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:flex lg:flex-col lg:gap-1", nearVictory && "max-md:grid-cols-[minmax(128px,.32fr)_minmax(0,1fr)]")}>
        <div
          className={cn("self-seat flex min-w-0 items-center gap-1.5 rounded-xl border border-[#6d5434]/15 bg-white/35 px-2 py-1.5 md:col-start-1 md:row-start-1 lg:border-transparent lg:bg-transparent lg:py-1", nearVictory && "max-md:grid max-md:grid-cols-[.625rem_minmax(0,1fr)_auto] max-md:gap-x-1 max-md:gap-y-0")}
          data-player-id={game.you.id}
          data-player-target={game.you.id}
          data-current-player="true"
        >
          <PlayerColorDot color={game.you.color} className="size-2.5 ring-[#6d5434]/25 lg:size-3" />
          <div className={cn("min-w-0 flex-1", nearVictory && "max-md:contents")}>
            <strong className={cn("block truncate text-xs text-[#243d39] lg:text-base lg:text-[var(--game-rail-ink)]", nearVictory && "max-md:col-span-2")} title={game.you.name}>{game.you.name}</strong>
            <span data-self-resource-total="true" className={cn("block text-[9px] font-bold text-[#6c6d62] lg:text-xs lg:text-[var(--game-rail-muted)]", nearVictory && "max-md:col-span-2 max-md:whitespace-nowrap")}>资源总数 {game.you.resourceCardCount}</span>
          </div>
          <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
            <PlayerScoreBadge player={game.you} victoryPointsToWin={game.victoryPointsToWin} active={game.phase.kind === "turn"} />
            {game.turnTimer?.playerId === game.you.id ? <TurnTimerBadge timer={game.turnTimer} className="xl:hidden" /> : null}
          </div>
        </div>

        <section className="grid grid-cols-5 gap-1 md:col-start-1 md:row-start-2" aria-label="你的资源">
          {RESOURCE_TYPES.map((resource) => {
            const count = game.you.resources[resource];
            const selected = activeSelection?.[resource] ?? 0;
            const interactive = activeSelection !== null;
            return (
              <ResourceCard
                key={resource}
                resource={resource}
                count={count}
                selectedCount={selected}
                targetId={`${game.you.id}:${resource}`}
                className="min-h-12 px-1.5 py-1 lg:shadow-none"
                disabled={interactive && selected >= count}
                ariaLabel={interactive
                  ? `在${activeSelectionLabel}中加入 1 张${resourceLabel(resource)}，持有 ${count} 张，已选 ${selected} 张`
                  : `${resourceLabel(resource)} ${count} 张`}
                onClick={interactive ? () => addFromHand(resource) : undefined}
              />
            );
          })}
        </section>

        <PlayerPublicStats
          player={game.you}
          tone="light"
          density="compact"
          className="col-span-2 rounded-lg border border-[#6d5434]/10 bg-white/25 p-0.5 md:col-span-1 md:col-start-1 md:row-start-3 lg:border-transparent lg:bg-transparent lg:[&>span]:bg-white/5 lg:[&_span]:text-[var(--game-rail-muted)] lg:[&_b]:text-[var(--game-rail-ink)]"
        />

        <DockActions game={game} compact={compact} buildMode={buildMode} selectedRobberHexId={selectedRobberHexId}>
          <GameControls
            game={game}
            busy={busy}
            onCommand={onCommand}
            buildMode={buildMode}
            selectedRobberHexId={selectedRobberHexId}
            onBuildModeChange={onBuildModeChange}
            discardSelection={discardSelection}
            onDiscardSelectionChange={setDiscardSelection}
          />
        </DockActions>
      </div>
    </Card>
  );
}
