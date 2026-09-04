import { RESOURCE_TYPES, emptyResourceHand, type ResourceHand, type ResourceType } from "@catan/game-core";
import type { GameCommand, GameView } from "@catan/protocol";
import { useState } from "react";
import { ResourceCardPalette, SelectedResourceCards } from "./ResourceCardPicker.js";
import { resourceLabel } from "./ResourceCard.js";
import { cardLabel } from "./RulesReference.js";

type Resource = ResourceType;
type CardType = GameView["you"]["developmentCards"][number]["type"];

export interface DevelopmentControlsProps {
  readonly game: GameView;
  readonly busy: boolean;
  readonly onCommand: (command: GameCommand) => void;
}

export function DevelopmentControls({ game, busy, onCommand }: DevelopmentControlsProps) {
  const [resource, setResource] = useState<Resource>("ore");
  const [harvestSelection, setHarvestSelection] = useState<ResourceHand>(emptyResourceHand);
  const harvestTotal = resourceSelectionTotal(harvestSelection);
  const harvestResources = selectedResourcePair(harvestSelection);
  const harvestMaximums = resourceChoiceMaximums(harvestSelection, game.bankResources);
  const canBuy = game.interaction.kind === "turn-action" &&
    game.developmentDeckCount > 0 &&
    game.you.resources.wool > 0 &&
    game.you.resources.grain > 0 &&
    game.you.resources.ore > 0;
  const turnNumber = game.phase.kind === "turn" ? game.phase.turnNumber : 0;

  if (game.interaction.kind !== "turn-action" && game.interaction.kind !== "turn-roll") return null;

  return (
    <details className="development-drawer min-w-0 rounded-md border border-[var(--sidebar-line,#4e39232e)] bg-[var(--sidebar-control,#fffaf0b3)]" data-resource-sink="development">
      <summary className="h-8 cursor-pointer list-inside content-center px-2 text-sm font-bold whitespace-nowrap">发展卡（{game.you.developmentCards.length}）</summary>
      <div className="development-stack p-2">
        {game.you.developmentCards.length === 0 ? <p>尚无发展卡</p> : null}
        {game.you.developmentCards.map((card) => {
          const playable =
            card.type !== "victory-point" &&
            card.acquiredTurn < turnNumber &&
            !game.developmentCardPlayedThisTurn;
          // Why the button is grey. The drawer is too narrow to say it in place,
          // so it rides on the button and is spelled out in the guide.
          const blocker = card.type === "victory-point" || playable
            ? undefined
            : game.developmentCardPlayedThisTurn
              ? "本回合已经用过一张发展卡"
              : card.acquiredTurn >= turnNumber
                ? "本回合刚买到，下回合才能用"
                : "先掷骰子";
          return (
            <div className="development-card text-[#263d39]" key={card.id}>
              <span>{cardLabel(card.type)}</span>
              {card.type === "victory-point" ? <small>隐藏 1 分</small> : null}
              {card.type === "monopoly" ? <ResourceSelect value={resource} onChange={setResource} label="垄断要抢的资源" /> : null}
              {card.type === "resource-choice" ? (
                <div className="order-2 col-span-full grid gap-2 rounded-lg border border-[#6d5434]/15 bg-[#fffaf0]/65 p-2">
                  <p className="m-0 text-center text-xs font-bold text-[#6b716a]">选择 2 张资源 · 已选 {harvestTotal}/2</p>
                  <ResourceCardPalette
                    label="丰收资源"
                    value={harvestSelection}
                    maximums={harvestMaximums}
                    counts={game.bankResources ?? undefined}
                    compact
                    onChange={setHarvestSelection}
                  />
                  <SelectedResourceCards
                    label="丰收已选资源"
                    value={harvestSelection}
                    emptyLabel="点击上方资源卡进行选择"
                    onChange={setHarvestSelection}
                  />
                </div>
              ) : null}
              {card.type === "victory-point" ? null : (
                <button
                  className={card.type === "resource-choice" ? "build-button order-1" : "build-button"}
                  type="button"
                  disabled={busy || !playable || (card.type === "resource-choice" && harvestResources === null)}
                  title={blocker}
                  onClick={() => {
                    if (card.type === "resource-choice") {
                      if (harvestResources === null) return;
                      onCommand({ type: "PlayResourceChoice", cardId: card.id, resources: harvestResources });
                      setHarvestSelection(emptyResourceHand());
                      return;
                    }
                    onCommand(cardCommand(card.id, card.type, resource));
                  }}
                >
                  {card.type === "resource-choice" ? "确定" : "使用"}
                </button>
              )}
            </div>
          );
        })}
        {game.interaction.kind === "turn-action" ? (
          <button className="build-button" type="button" disabled={busy || !canBuy} onClick={() => onCommand({ type: "BuyDevelopmentCard" })}>
            购买发展卡（羊+麦+矿）· 剩余 {game.developmentDeckCount}
          </button>
        ) : null}
      </div>
    </details>
  );
}

function cardCommand(
  cardId: string,
  type: CardType,
  resource: Resource,
): GameCommand {
  switch (type) {
    case "knight": return { type: "PlayKnight", cardId };
    case "road-building": return { type: "PlayRoadBuilding", cardId };
    case "monopoly": return { type: "PlayMonopoly", cardId, resource };
    case "resource-choice": throw new Error("Resource choice cards require two selected resources");
    case "victory-point": throw new Error("Victory point cards are passive");
  }
}

function ResourceSelect({ value, onChange, label }: {
  readonly value: Resource;
  readonly onChange: (value: Resource) => void;
  readonly label: string;
}) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as Resource)}>
      {RESOURCE_TYPES.map((candidate) => <option key={candidate} value={candidate}>{resourceLabel(candidate)}</option>)}
    </select>
  );
}

function selectedResources(selection: ResourceHand): readonly Resource[] {
  return RESOURCE_TYPES.flatMap((resource) => Array.from({ length: selection[resource] }, () => resource));
}

function resourceSelectionTotal(selection: ResourceHand): number {
  return RESOURCE_TYPES.reduce((total, resource) => total + selection[resource], 0);
}

function selectedResourcePair(selection: ResourceHand): readonly [Resource, Resource] | null {
  const resources = selectedResources(selection);
  return resources.length === 2 ? [resources[0]!, resources[1]!] : null;
}

function resourceChoiceMaximums(selection: ResourceHand, bank: ResourceHand | null): ResourceHand {
  const total = resourceSelectionTotal(selection);
  let maximums = emptyResourceHand();
  for (const resource of RESOURCE_TYPES) {
    const remainingSlots = Math.max(0, 2 - total);
    const bankLimit = bank?.[resource] ?? 2;
    maximums = {
      ...maximums,
      [resource]: Math.min(bankLimit, selection[resource] + remainingSlots),
    };
  }
  return maximums;
}
