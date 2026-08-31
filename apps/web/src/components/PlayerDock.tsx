import { RESOURCE_TYPES, type ResourceHand, type ResourceType } from "@catan/game-core";
import { describeAction, type GameCommand, type GameView } from "@catan/protocol";
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
import { PlayerScoreBadge } from "./PlayerScoreBadge.js";
import { cn } from "@/lib/utils.js";

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
  const prompt = describeAction(game.interaction);

  const addFromHand = (resource: ResourceType) => {
    if (activeSelection === null) return;
    const next = incrementResource(activeSelection, resource, game.you.resources[resource]);
    setDiscardSelection(next);
  };

  return (
    <Card data-player-dock="true" data-action-attention={prompt?.tone ?? "none"} className={cn(
      "player-dock relative col-start-1 row-start-3 min-h-0 gap-0 overflow-visible border-white/20 bg-[#f3e6c8]/96 p-2 shadow-2xl backdrop-blur-sm lg:row-start-2 lg:p-1.5",
      prompt?.tone === "required" && "border-[#e49c96] bg-[#fce5e3] ring-2 ring-[#e49c96]/65",
      prompt?.tone === "trade" && "border-[#a9c7c0] ring-1 ring-[#a9c7c0]/40",
    )}>
      {ownTimer === null ? null : (
        <span className="absolute bottom-[calc(100%+.75rem)] left-5 z-30" data-turn-timer-slot="self">
          <TurnTimerBadge timer={ownTimer} className="px-2 py-1 text-xs" />
        </span>
      )}
      <div className="grid grid-cols-[minmax(112px,.26fr)_minmax(0,1fr)] items-stretch gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] xl:grid-cols-[minmax(10rem,.4fr)_minmax(14rem,.7fr)_minmax(19rem,1fr)] xl:gap-y-1">
        <div
          className="self-seat flex min-w-0 items-center gap-1.5 rounded-xl border border-[#6d5434]/15 bg-white/35 px-2 py-1.5 md:col-start-1 md:row-start-1 xl:py-1"
          data-player-id={game.you.id}
          data-player-target={game.you.id}
          data-current-player="true"
        >
          <PlayerColorDot color={game.you.color} className="size-2.5 ring-[#6d5434]/25 lg:size-3" />
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-xs text-[#243d39] lg:text-base" title={game.you.name}>{game.you.name}</strong>
            <span className="block text-[9px] font-bold text-[#6c6d62] lg:text-xs">资源总数 {game.you.resourceCardCount}</span>
          </div>
          <PlayerScoreBadge player={game.you} className="ml-auto" />
        </div>

        <section className="grid grid-cols-5 gap-1 md:col-start-1 md:row-start-2 xl:col-start-2 xl:row-span-2 xl:row-start-1" aria-label="你的资源">
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
          density="compact"
          className="col-span-2 rounded-lg border border-[#6d5434]/10 bg-white/25 p-0.5 md:col-span-1 md:col-start-1 md:row-start-3 xl:row-start-2"
        />

        <section className="col-span-2 rounded-xl border border-[#6d5434]/15 bg-white/40 px-2 py-1.5 md:col-span-1 md:col-start-2 md:row-span-3 md:row-start-1 md:max-h-[min(28dvh,13rem)] md:overflow-y-auto lg:py-1 xl:col-start-3 xl:row-span-2" aria-label="本回合操作">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span data-action-title="true" className={cn("flex min-w-0 items-center gap-1.5 text-xs font-black text-[#5d665f] lg:text-sm", prompt?.tone === "required" && "text-[#8c3f3a]")}>
              <Hammer className="size-3.5 shrink-0" aria-hidden="true" />{prompt?.title ?? "本回合操作"}
            </span>
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
