import type { GameCommand, GameView } from "@catan/protocol";
import { useState } from "react";
import { Button } from "@/components/ui/button.js";
import { BookOpen } from "lucide-react";
import { cardLabel, RulesReference } from "./RulesReference.js";

const RESOURCES = ["brick", "lumber", "wool", "grain", "ore"] as const;
type Resource = (typeof RESOURCES)[number];
type CardType = GameView["you"]["developmentCards"][number]["type"];

export interface DevelopmentControlsProps {
  readonly game: GameView;
  readonly busy: boolean;
  readonly onCommand: (command: GameCommand) => void;
}

export function DevelopmentControls({ game, busy, onCommand }: DevelopmentControlsProps) {
  const [resource, setResource] = useState<Resource>("ore");
  const [secondResource, setSecondResource] = useState<Resource>("grain");
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
        <RulesReference
          ruleProfile={game.ruleProfile}
          trigger={
            <Button type="button" size="sm" variant="outline" className="h-7 w-full justify-center gap-1 px-1 text-xs">
              <BookOpen className="size-3.5 shrink-0" />说明
            </Button>
          }
        />
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
                <span className="card-selects">
                  <ResourceSelect value={resource} onChange={setResource} label="丰收的第一张资源" />
                  <ResourceSelect value={secondResource} onChange={setSecondResource} label="丰收的第二张资源" />
                </span>
              ) : null}
              {card.type === "victory-point" ? null : (
                <button
                  className="build-button"
                  type="button"
                  disabled={busy || !playable}
                  title={blocker}
                  onClick={() => onCommand(cardCommand(card.id, card.type, resource, secondResource))}
                >
                  使用
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
  secondResource: Resource,
): GameCommand {
  switch (type) {
    case "knight": return { type: "PlayKnight", cardId };
    case "road-building": return { type: "PlayRoadBuilding", cardId };
    case "monopoly": return { type: "PlayMonopoly", cardId, resource };
    case "resource-choice": return { type: "PlayResourceChoice", cardId, resources: [resource, secondResource] };
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
      {RESOURCES.map((candidate) => <option key={candidate} value={candidate}>{resourceLabel(candidate)}</option>)}
    </select>
  );
}

function resourceLabel(resource: Resource): string {
  return { brick: "砖", lumber: "木", wool: "羊", grain: "麦", ore: "矿" }[resource];
}
