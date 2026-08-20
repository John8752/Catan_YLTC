import type { GameCommand, GameView } from "@catan/protocol";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/lib/utils.js";
import { TradeControls } from "./TradeControls.js";
import { DevelopmentControls } from "./DevelopmentControls.js";

const RESOURCES = ["brick", "lumber", "wool", "grain", "ore"] as const;
type Resource = (typeof RESOURCES)[number];

export interface GameControlsProps {
  readonly game: GameView;
  readonly busy: boolean;
  readonly onCommand: (command: GameCommand) => void;
  readonly buildMode: "road" | "settlement" | "city" | null;
  readonly onBuildModeChange: (mode: "road" | "settlement" | "city" | null) => void;
}

export function GameControls({ game, busy, onCommand, buildMode, onBuildModeChange }: GameControlsProps) {
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
      <div className="action-stack xl:grid-cols-2">
        <DevelopmentControls game={game} busy={busy} onCommand={onCommand} />
        <Button type="button" disabled={busy} onClick={() => onCommand({ type: "RollDice" })}>
          {busy ? "掷骰中…" : "掷骰子"}
        </Button>
      </div>
    );
  }

  if (game.interaction.kind === "turn-action") {
    return (
      <div className="action-stack xl:grid-cols-3 xl:items-start">
        <DevelopmentControls game={game} busy={busy} onCommand={onCommand} />
        <TradeControls game={game} busy={busy} onCommand={onCommand} />
        <Button type="button" disabled={busy} onClick={() => onCommand({ type: "EndTurn" })}>
          {busy ? "提交中…" : "结束回合"}
        </Button>
        <div className="build-buttons xl:col-span-3" aria-label="建造选项">
          {([
            ["road", "道路", game.interaction.roadEdgeIds.length],
            ["settlement", "定居点", game.interaction.settlementVertexIds.length],
            ["city", "城市", game.interaction.cityVertexIds.length],
          ] as const).map(([mode, label, targets]) => (
            <Button
              key={mode}
              variant="outline"
              size="sm"
              className={cn(
                "border-[#a65c43]/25 bg-[#fffaf0]/70",
                buildMode === mode && "border-[#b45c42] bg-[#b45c42] text-white hover:bg-[#9f4d38] hover:text-white",
              )}
              type="button"
              disabled={busy || targets === 0}
              onClick={() => onBuildModeChange(buildMode === mode ? null : mode)}
            >
              {label}
            </Button>
          ))}
        </div>
        <small className="xl:col-span-3">道路：砖+木　定居点：砖+木+羊+麦　城市：2麦+3矿</small>
      </div>
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
        <Button type="submit" disabled={busy || selectedCount !== game.interaction.requiredCount}>
          确认弃牌
        </Button>
      </form>
    );
  }

  if (game.interaction.kind === "robber") {
    return (
      <form
        className="resolution-form xl:grid-cols-2 xl:items-end"
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
        <Button type="submit" disabled={busy || robberHexId === ""}>移动强盗</Button>
      </form>
    );
  }

  if (game.interaction.kind === "trade-response") {
    return <TradeControls game={game} busy={busy} onCommand={onCommand} />;
  }

  if (game.interaction.kind === "free-road") {
    return <p>请在棋盘高亮边上放置免费道路。</p>;
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
