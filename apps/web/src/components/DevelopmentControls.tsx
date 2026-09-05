import type { GameCommand, GameView } from "@catan/protocol";
import { cardLabel } from "./RulesReference.js";
import { DevelopmentCardConfirmation } from "./DevelopmentCardConfirmation.js";

export interface DevelopmentControlsProps {
  readonly game: GameView;
  readonly busy: boolean;
  readonly onCommand: (command: GameCommand) => void;
}

export function DevelopmentControls({ game, busy, onCommand }: DevelopmentControlsProps) {
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
              {card.type === "victory-point" ? null : (
                <DevelopmentCardConfirmation
                  game={game}
                  cardId={card.id}
                  cardType={card.type}
                  busy={busy}
                  onConfirm={onCommand}
                >
                  <button
                    className="build-button"
                    type="button"
                    disabled={busy || !playable}
                    title={blocker}
                  >
                    使用
                  </button>
                </DevelopmentCardConfirmation>
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
