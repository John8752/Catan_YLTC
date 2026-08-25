import { RESOURCE_TYPES, type ResourceHand, type ResourceType } from "@catan/game-core";
import type { GameCommand, GameView } from "@catan/protocol";
import { Button } from "@/components/ui/button.js";
import { cn } from "@/lib/utils.js";
import { TradeControls } from "./TradeControls.js";
import { DevelopmentControls } from "./DevelopmentControls.js";
import { resourceLabel } from "./ResourceCard.js";
import { SelectedResourceCards, emptyResourceSelection } from "./ResourceCardPicker.js";

type Resource = ResourceType;

export interface GameControlsProps {
  readonly game: GameView;
  readonly busy: boolean;
  readonly onCommand: (command: GameCommand) => void;
  readonly buildMode: "road" | "settlement" | "city" | null;
  readonly selectedRobberHexId: string | null;
  readonly onBuildModeChange: (mode: "road" | "settlement" | "city" | null) => void;
  readonly discardSelection?: ResourceHand;
  readonly onDiscardSelectionChange?: (selection: ResourceHand) => void;
  readonly tradeGive?: ResourceHand;
  readonly onTradeGiveChange?: (selection: ResourceHand) => void;
  readonly tradeComposerOpen?: boolean;
  readonly onTradeComposerOpenChange?: (open: boolean) => void;
}

export function GameControls({
  game,
  busy,
  onCommand,
  buildMode,
  selectedRobberHexId,
  onBuildModeChange,
  discardSelection = emptyResourceSelection(),
  onDiscardSelectionChange = () => undefined,
  tradeGive,
  onTradeGiveChange,
  tradeComposerOpen,
  onTradeComposerOpenChange,
}: GameControlsProps) {
  const selectedTarget = game.interaction.kind === "robber"
    ? game.interaction.targets.find((target) => target.hexId === selectedRobberHexId)
    : undefined;
  const selectedTargetHex = selectedTarget === undefined
    ? undefined
    : game.map.hexes.find((hex) => hex.id === selectedTarget.hexId);

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
        <TradeControls
          game={game}
          busy={busy}
          onCommand={onCommand}
          allowPlayerTrades={!game.interaction.pairedPlayer}
          playerGive={tradeGive}
          onPlayerGiveChange={onTradeGiveChange}
          composerOpen={tradeComposerOpen}
          onComposerOpenChange={onTradeComposerOpenChange}
          handPickerExternal={tradeGive !== undefined}
        />
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
    const selectedCount = RESOURCE_TYPES.reduce((total, resource) => total + discardSelection[resource], 0);
    return (
      <form
        className="resolution-form"
        onSubmit={(event) => {
          event.preventDefault();
          onCommand({ type: "DiscardResources", resources: discardSelection });
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <strong>弃牌 {selectedCount}/{game.interaction.requiredCount}</strong>
          <small>手牌添加 · 下方卡片撤回</small>
        </div>
        <SelectedResourceCards label="准备弃掉" value={discardSelection} onChange={onDiscardSelectionChange} emptyLabel="从左侧手牌选择要弃掉的资源" />
        <Button type="submit" disabled={busy || selectedCount !== game.interaction.requiredCount}>
          确认弃牌
        </Button>
      </form>
    );
  }

  if (game.interaction.kind === "robber") {
    if (selectedTarget !== undefined && selectedTarget.victimIds.length > 1) {
      return (
        <section className="robber-victim-picker" aria-label="选择偷取玩家">
          <div>
            <strong>选择要偷取的玩家</strong>
            <p>目的地：{hexLabel(
              selectedTargetHex?.terrain,
              selectedTargetHex?.numberToken,
            )}</p>
          </div>
          <div className="robber-victim-buttons">
            {selectedTarget.victimIds.map((id) => {
              const playerName = game.players.find((player) => player.id === id)?.name ?? id;
              return (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => onCommand({ type: "MoveRobber", hexId: selectedTarget.hexId, victimId: id })}
                >
                  偷取 {playerName}
                </Button>
              );
            })}
          </div>
          <small>也可以在棋盘上改选其他地块。</small>
        </section>
      );
    }

    return (
      <section className="robber-map-prompt" aria-label="移动强盗">
        <strong>在棋盘上选择强盗目的地</strong>
        <p>点击地块中心亮起的目标点。没有可偷取玩家时会直接移动；有多名玩家时再选择一人。</p>
      </section>
    );
  }

  if (game.interaction.kind === "trade-response") {
    return <p>请在右侧交易桌回应这份报价。</p>;
  }

  if (game.interaction.kind === "free-road") {
    return <p>请在棋盘高亮边上放置免费道路。</p>;
  }

  return <p>{game.interaction.instruction}</p>;
}

function hexLabel(terrain: string | undefined, numberToken: number | null | undefined): string {
  const name = terrain === undefined
    ? "地块"
    : terrain === "desert"
      ? "荒漠"
      : resourceLabel(terrain as Resource);
  return `${name} · ${numberToken ?? "无点数"}`;
}
