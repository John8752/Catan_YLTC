import type { GameCommand, GameView } from "@catan/protocol";
import { useState } from "react";

const RESOURCES = ["brick", "lumber", "wool", "grain", "ore"] as const;
type Resource = (typeof RESOURCES)[number];

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
    <details className="development-details">
      <summary>发展卡（{game.you.developmentCards.length}）</summary>
      <div className="development-stack">
        {game.you.developmentCards.length === 0 ? <p>尚无发展卡</p> : null}
        {game.you.developmentCards.map((card) => {
          const playable =
            card.type !== "victory-point" &&
            card.acquiredTurn < turnNumber &&
            !game.developmentCardPlayedThisTurn;
          return (
            <div className="development-card" key={card.id}>
              <span>{cardLabel(card.type)}</span>
              {card.type === "victory-point" ? <small>隐藏 1 分</small> : null}
              {card.type === "monopoly" ? <ResourceSelect value={resource} onChange={setResource} /> : null}
              {card.type === "resource-choice" ? (
                <span className="card-selects">
                  <ResourceSelect value={resource} onChange={setResource} />
                  <ResourceSelect value={secondResource} onChange={setSecondResource} />
                </span>
              ) : null}
              {card.type === "victory-point" ? null : (
                <button
                  className="build-button"
                  type="button"
                  disabled={busy || !playable}
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
  type: GameView["you"]["developmentCards"][number]["type"],
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

function ResourceSelect({ value, onChange }: { readonly value: Resource; readonly onChange: (value: Resource) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as Resource)}>
      {RESOURCES.map((candidate) => <option key={candidate} value={candidate}>{resourceLabel(candidate)}</option>)}
    </select>
  );
}

function cardLabel(type: string): string {
  return {
    knight: "骑士",
    "road-building": "道路建设",
    monopoly: "垄断",
    "resource-choice": "丰收",
    "victory-point": "隐藏胜利点",
  }[type] ?? type;
}

function resourceLabel(resource: Resource): string {
  return { brick: "砖", lumber: "木", wool: "羊", grain: "麦", ore: "矿" }[resource];
}
