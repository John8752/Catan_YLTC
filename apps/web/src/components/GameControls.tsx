import type { GameCommand, GameView } from "@catan/protocol";
import { useEffect, useMemo, useState } from "react";

const RESOURCES = ["brick", "lumber", "wool", "grain", "ore"] as const;
type Resource = (typeof RESOURCES)[number];

export interface GameControlsProps {
  readonly game: GameView;
  readonly busy: boolean;
  readonly onCommand: (command: GameCommand) => void;
}

export function GameControls({ game, busy, onCommand }: GameControlsProps) {
  const [discard, setDiscard] = useState<Record<Resource, number>>(emptySelection);
  const [robberHexId, setRobberHexId] = useState("");
  const [victimId, setVictimId] = useState("");

  useEffect(() => {
    setDiscard(emptySelection());
    setRobberHexId("");
    setVictimId("");
  }, [game.revision]);

  const selectedTarget = useMemo(
    () => game.interaction.kind === "robber"
      ? game.interaction.targets.find((target) => target.hexId === robberHexId)
      : undefined,
    [game.interaction, robberHexId],
  );
  const selectedVictim = selectedTarget?.victimIds.includes(victimId)
    ? victimId
    : (selectedTarget?.victimIds[0] ?? null);

  if (game.interaction.kind === "turn-roll") {
    return (
      <button className="primary-button" type="button" disabled={busy} onClick={() => onCommand({ type: "RollDice" })}>
        {busy ? "掷骰中…" : "掷骰子"}
      </button>
    );
  }

  if (game.interaction.kind === "turn-action") {
    return (
      <button className="primary-button" type="button" disabled={busy} onClick={() => onCommand({ type: "EndTurn" })}>
        {busy ? "提交中…" : "结束回合"}
      </button>
    );
  }

  if (game.interaction.kind === "discard") {
    const selectedCount = RESOURCES.reduce((total, resource) => total + discard[resource], 0);
    return (
      <form
        className="resolution-form"
        onSubmit={(event) => {
          event.preventDefault();
          onCommand({ type: "DiscardResources", resources: discard });
        }}
      >
        <strong>弃牌 {selectedCount}/{game.interaction.requiredCount}</strong>
        <div className="discard-grid">
          {RESOURCES.map((resource) => (
            <label key={resource}>
              <span>{resourceLabel(resource)}</span>
              <input
                type="number"
                min="0"
                max={game.you.resources[resource]}
                value={discard[resource]}
                onChange={(event) => setDiscard({
                  ...discard,
                  [resource]: Math.max(0, Math.min(game.you.resources[resource], Number(event.target.value))),
                })}
              />
            </label>
          ))}
        </div>
        <button className="primary-button" type="submit" disabled={busy || selectedCount !== game.interaction.requiredCount}>
          确认弃牌
        </button>
      </form>
    );
  }

  if (game.interaction.kind === "robber") {
    return (
      <form
        className="resolution-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (robberHexId !== "") {
            onCommand({ type: "MoveRobber", hexId: robberHexId, victimId: selectedVictim });
          }
        }}
      >
        <label>
          <span>强盗目的地</span>
          <select value={robberHexId} onChange={(event) => { setRobberHexId(event.target.value); setVictimId(""); }}>
            <option value="">请选择地块</option>
            {game.interaction.targets.map((target) => {
              const hex = game.map.hexes.find((candidate) => candidate.id === target.hexId);
              return <option key={target.hexId} value={target.hexId}>{hexLabel(hex?.terrain, hex?.numberToken)}</option>;
            })}
          </select>
        </label>
        {selectedTarget !== undefined && selectedTarget.victimIds.length > 0 ? (
          <label>
            <span>偷取玩家</span>
            <select value={selectedVictim ?? ""} onChange={(event) => setVictimId(event.target.value)}>
              {selectedTarget.victimIds.map((id) => (
                <option key={id} value={id}>{game.players.find((player) => player.id === id)?.name ?? id}</option>
              ))}
            </select>
          </label>
        ) : null}
        <button className="primary-button" type="submit" disabled={busy || robberHexId === ""}>移动强盗</button>
      </form>
    );
  }

  return <p>{game.interaction.instruction}</p>;
}

function emptySelection(): Record<Resource, number> {
  return { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 };
}

function resourceLabel(resource: Resource): string {
  return { brick: "砖", lumber: "木", wool: "羊", grain: "麦", ore: "矿" }[resource];
}

function hexLabel(terrain: string | undefined, numberToken: number | null | undefined): string {
  const name = terrain === undefined
    ? "地块"
    : terrain === "desert"
      ? "荒漠"
      : resourceLabel(terrain as Resource);
  return `${name} · ${numberToken ?? "无点数"}`;
}
