import { RESOURCE_TYPES, type ResourceHand, type ResourceType } from "@catan/game-core";
import type { GameCommand, GameView } from "@catan/protocol";
import { Dices, Hammer } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge.js";
import { Card } from "@/components/ui/card.js";
import { GameControls } from "./GameControls.js";
import { ResourceCard, resourceLabel } from "./ResourceCard.js";
import { emptyResourceSelection, incrementResource } from "./ResourceCardPicker.js";
import { TurnTimerBadge } from "./TurnTimerBadge.js";
import { PlayerPublicStats } from "./PlayerPublicStats.js";
import { PlayerColorDot } from "./PlayerColorDot.js";

export interface PlayerDockProps {
  readonly game: GameView;
  readonly busy: boolean;
  readonly onCommand: (command: GameCommand) => void;
  readonly buildMode: "road" | "settlement" | "city" | null;
  readonly selectedRobberHexId: string | null;
  readonly onBuildModeChange: (mode: "road" | "settlement" | "city" | null) => void;
}

export function PlayerDock({
  game,
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
  const ownTimer = game.turnTimer?.playerId === game.you.id ? game.turnTimer : null;

  const addFromHand = (resource: ResourceType) => {
    if (activeSelection === null) return;
    const next = incrementResource(activeSelection, resource, game.you.resources[resource]);
    setDiscardSelection(next);
  };

  return (
    <Card className="player-dock relative gap-0 overflow-visible border-white/20 bg-[#f3e6c8]/96 p-2 shadow-2xl backdrop-blur-sm lg:col-start-1 lg:row-start-4 lg:p-3">
      {ownTimer === null ? null : (
        <span className="absolute bottom-[calc(100%+.75rem)] left-5 z-30" data-turn-timer-slot="self">
          <TurnTimerBadge timer={ownTimer} className="px-2 py-1 text-xs" />
        </span>
      )}
      <div className="grid grid-cols-[minmax(88px,.26fr)_minmax(0,1fr)] items-stretch gap-2 lg:gap-3 xl:grid-cols-[minmax(132px,auto)_minmax(270px,.75fr)_minmax(430px,1.25fr)]">
        <div
          className="self-seat flex min-w-0 items-center gap-1.5 rounded-xl border border-[#6d5434]/15 bg-white/35 px-2 py-1.5 lg:gap-2 lg:px-3 lg:py-2"
          data-player-id={game.you.id}
          data-player-target={game.you.id}
          data-current-player="true"
        >
          <PlayerColorDot color={game.you.color} className="size-2.5 ring-[#6d5434]/25 lg:size-3" />
          <div className="min-w-0">
            <strong className="block truncate text-xs text-[#243d39] lg:text-sm" title={game.you.name}>{game.you.name}</strong>
            <span className="block text-[9px] font-bold text-[#6c6d62] lg:text-[10px]">资源总数 {game.you.resourceCardCount}</span>
          </div>
        </div>

        <section className="grid grid-cols-5 gap-1 lg:gap-2" aria-label="你的资源">
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
                className="max-lg:min-h-12 max-lg:px-1.5 max-lg:py-1"
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
          density="comfortable"
          className="col-span-2 rounded-lg border border-[#6d5434]/10 bg-white/25 p-0.5 xl:col-start-1 xl:row-start-2"
        />

        <section className="col-span-2 rounded-xl border border-[#6d5434]/15 bg-white/40 px-2 py-1.5 lg:px-3 lg:py-2 xl:col-span-1 xl:col-start-3 xl:row-span-2 xl:row-start-1" aria-label="本回合操作">
          <div className="mb-1 flex items-center justify-between gap-2 lg:mb-1.5">
            <span className="flex items-center gap-1.5 text-[10px] font-black tracking-[.12em] text-[#5d665f] uppercase"><Hammer className="size-3.5" />本回合操作</span>
            {game.lastRoll === null ? null : (
              <Badge
                variant="secondary"
                className="gap-1"
                aria-label={`骰子：${game.lastRoll[0]} + ${game.lastRoll[1]}`}
              >
                <Dices className="size-3.5" aria-hidden="true" />{game.lastRoll[0]} + {game.lastRoll[1]}
              </Badge>
            )}
          </div>
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
        </section>
      </div>
    </Card>
  );
}
