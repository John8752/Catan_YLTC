import { RESOURCE_TYPES, type ResourceHand, type ResourceType } from "@catan/game-core";
import type { GameCommand, GameView } from "@catan/protocol";
import { Dices, Hammer, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge.js";
import { Card } from "@/components/ui/card.js";
import { GameControls } from "./GameControls.js";
import { ResourceCard, resourceLabel } from "./ResourceCard.js";
import { emptyResourceSelection, incrementResource } from "./ResourceCardPicker.js";

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
  const [tradeGive, setTradeGive] = useState<ResourceHand>(emptyResourceSelection);
  const [tradeComposerOpen, setTradeComposerOpen] = useState(false);

  useEffect(() => {
    if (game.interaction.kind !== "discard") setDiscardSelection(emptyResourceSelection());
  }, [game.interaction.kind]);

  useEffect(() => {
    if (game.openTrade !== null || game.interaction.kind !== "turn-action") {
      setTradeComposerOpen(false);
      setTradeGive(emptyResourceSelection());
    }
  }, [game.interaction.kind, game.openTrade]);

  const activeSelection = game.interaction.kind === "discard"
    ? discardSelection
    : tradeComposerOpen
      ? tradeGive
      : null;
  const activeSelectionLabel = game.interaction.kind === "discard" ? "准备弃掉" : "我提供";

  const addFromHand = (resource: ResourceType) => {
    if (activeSelection === null) return;
    const next = incrementResource(activeSelection, resource, game.you.resources[resource]);
    if (game.interaction.kind === "discard") setDiscardSelection(next);
    else setTradeGive(next);
  };

  return (
    <Card className="player-dock relative gap-0 overflow-visible border-white/20 bg-[#f3e6c8]/96 p-3 shadow-2xl backdrop-blur-sm lg:col-start-1 lg:row-start-3">
      <div className="grid items-stretch gap-3 xl:grid-cols-[auto_minmax(270px,.75fr)_minmax(430px,1.25fr)]">
        <div className="flex min-w-28 items-center gap-2 rounded-xl border border-[#6d5434]/15 bg-white/35 px-3 py-2">
          <span className="grid size-10 place-items-center rounded-full bg-[#1f5651] text-[#fff8df]"><UserRound className="size-5" /></span>
          <div>
            <span className="block text-[10px] font-black tracking-[.12em] text-[#9d513d] uppercase">你的席位</span>
            <strong className="text-sm text-[#243d39]">{game.you.name}</strong>
          </div>
        </div>

        <section className="grid grid-cols-5 gap-2" aria-label="你的资源">
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
                disabled={interactive && selected >= count}
                ariaLabel={interactive
                  ? `在${activeSelectionLabel}中加入 1 张${resourceLabel(resource)}，持有 ${count} 张，已选 ${selected} 张`
                  : `${resourceLabel(resource)} ${count} 张`}
                onClick={interactive ? () => addFromHand(resource) : undefined}
              />
            );
          })}
        </section>

        <section className="rounded-xl border border-[#6d5434]/15 bg-white/40 px-3 py-2" aria-label="本回合操作">
          <div className="mb-1.5 flex items-center justify-between gap-2">
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
            tradeGive={tradeGive}
            onTradeGiveChange={setTradeGive}
            tradeComposerOpen={tradeComposerOpen}
            onTradeComposerOpenChange={setTradeComposerOpen}
          />
        </section>
      </div>
    </Card>
  );
}
