import type { GameCommand, GameView } from "@catan/protocol";
import { useState } from "react";

const RESOURCES = ["brick", "lumber", "wool", "grain", "ore"] as const;
type Resource = (typeof RESOURCES)[number];

export interface TradeControlsProps {
  readonly game: GameView;
  readonly busy: boolean;
  readonly onCommand: (command: GameCommand) => void;
}

export function TradeControls({ game, busy, onCommand }: TradeControlsProps) {
  const [give, setGive] = useState<Resource>("brick");
  const [giveCount, setGiveCount] = useState(1);
  const [receive, setReceive] = useState<Resource>("ore");
  const [receiveCount, setReceiveCount] = useState(1);

  if (game.openTrade !== null) {
    const proposer = game.players.find((player) => player.id === game.openTrade?.proposerId);
    const ownOffer = game.openTrade.proposerId === game.you.id;
    return (
      <section className="trade-card" aria-label="玩家交易报价">
        <strong>{proposer?.name ?? "玩家"} 的报价</strong>
        <p>付出 {handLabel(game.openTrade.give)}，换取 {handLabel(game.openTrade.receive)}</p>
        <button
          className="build-button"
          type="button"
          disabled={busy}
          onClick={() => onCommand(ownOffer
            ? { type: "CancelTradeOffer", offerId: game.openTrade?.offerId ?? "" }
            : { type: "AcceptTradeOffer", offerId: game.openTrade?.offerId ?? "" })}
        >
          {ownOffer ? "取消报价" : "接受交易"}
        </button>
      </section>
    );
  }

  if (game.interaction.kind !== "turn-action") return null;
  const sameResource = give === receive;
  return (
    <details className="trade-details">
      <summary>交易</summary>
      <div className="trade-forms">
        <form
          className="trade-form"
          onSubmit={(event) => {
            event.preventDefault();
            onCommand({
              type: "OpenTradeOffer",
              offerId: crypto.randomUUID(),
              give: amounts(give, giveCount),
              receive: amounts(receive, receiveCount),
            });
          }}
        >
          <strong>向玩家报价</strong>
          <ResourceAmount label="我给" resource={give} count={giveCount} onResource={setGive} onCount={setGiveCount} />
          <ResourceAmount label="我收" resource={receive} count={receiveCount} onResource={setReceive} onCount={setReceiveCount} />
          <button className="build-button" type="submit" disabled={busy || sameResource || game.you.resources[give] < giveCount}>发布报价</button>
        </form>
        <form
          className="trade-form"
          onSubmit={(event) => {
            event.preventDefault();
            onCommand({ type: "MaritimeTrade", give, receive });
          }}
        >
          <strong>与银行交易</strong>
          <p>{game.you.maritimeRatios[give]} 个{resourceLabel(give)}换 1 个{resourceLabel(receive)}</p>
          <button
            className="build-button"
            type="submit"
            disabled={busy || sameResource || game.you.resources[give] < game.you.maritimeRatios[give]}
          >
            确认海运
          </button>
        </form>
      </div>
    </details>
  );
}

interface ResourceAmountProps {
  readonly label: string;
  readonly resource: Resource;
  readonly count: number;
  readonly onResource: (resource: Resource) => void;
  readonly onCount: (count: number) => void;
}

function ResourceAmount({ label, resource, count, onResource, onCount }: ResourceAmountProps) {
  return (
    <label className="resource-amount">
      <span>{label}</span>
      <select value={resource} onChange={(event) => onResource(event.target.value as Resource)}>
        {RESOURCES.map((candidate) => <option key={candidate} value={candidate}>{resourceLabel(candidate)}</option>)}
      </select>
      <input type="number" min="1" max="19" value={count} onChange={(event) => onCount(Math.max(1, Number(event.target.value)))} />
    </label>
  );
}

function amounts(resource: Resource, count: number) {
  return { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0, [resource]: count };
}

function handLabel(hand: Record<Resource, number>): string {
  return RESOURCES.filter((resource) => hand[resource] > 0)
    .map((resource) => `${hand[resource]} ${resourceLabel(resource)}`)
    .join(" + ");
}

function resourceLabel(resource: Resource): string {
  return { brick: "砖", lumber: "木", wool: "羊", grain: "麦", ore: "矿" }[resource];
}
