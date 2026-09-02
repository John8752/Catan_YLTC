import type { ActionAttentionEffectView, GameCommand, GameView, VictoryWarningEffectView } from "@catan/protocol";
import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.js";
import { DEFAULT_BOARD_SCALE, useBoardViewport } from "@/hooks/use-board-viewport.js";
import {
  axialToPixel,
  BOARD_HEX_SIZE,
  BoardPorts,
  BoardTerrain,
  boardViewBox,
  terrainLabel,
  ROBBER_OFFSET,
} from "./BoardMap.js";
import { ConstructionTargets } from "./ConstructionTargets.js";
import { BankSupply } from "./BankSupply.js";
import { BoardZoomControls } from "./BoardZoomControls.js";
import { ActionAttentionBanner } from "@/effects/ActionAttentionBanner.js";

export interface BoardProps {
  readonly game: GameView;
  readonly compact?: boolean;
  readonly infoHost?: HTMLElement | null;
  readonly roomControls?: ReactNode;
  readonly bankSupply?: ReactNode;
  readonly actionNotice?: ActionAttentionEffectView | null;
  readonly victoryNotice?: VictoryWarningEffectView | null;
  readonly busy?: boolean;
  readonly onCommand?: (command: GameCommand) => void;
  readonly buildMode?: "road" | "settlement" | "city" | null;
  readonly selectedRobberHexId?: string | null;
  /** A spot the AI intent read pointed at, marked but never selectable. */
  readonly intentFocusVertexId?: string | null;
  readonly onRobberHexSelect?: (hexId: string) => void;
}

export function Board({
  game,
  compact = false,
  infoHost = null,
  roomControls,
  bankSupply = <BankSupply resources={game.bankResources} />,
  actionNotice = null,
  victoryNotice = null,
  busy = false,
  onCommand,
  buildMode = null,
  selectedRobberHexId = null,
  intentFocusVertexId = null,
  onRobberHexSelect,
}: BoardProps) {
  const robberHex = game.map.hexes.find((hex) => hex.id === game.map.robberHexId);
  const viewport = useBoardViewport(DEFAULT_BOARD_SCALE);
  const [pendingRoadCommand, setPendingRoadCommand] = useState<Extract<GameCommand, { type: "PlaceInitialRoad" | "BuildRoad" | "BuildFreeRoad" }> | null>(null);

  useEffect(() => setPendingRoadCommand(null), [game.revision]);

  const handleBoardCommand = (command: GameCommand) => {
    if (isRoadCommand(command) && shouldConfirmRoadOnThisDevice()) {
      setPendingRoadCommand(command);
      return;
    }
    onCommand?.(command);
  };

  const heading = <>
    <div className="board-heading flex flex-wrap items-center justify-between gap-1">
      {infoHost === null ? <p className="eyebrow">种子 {game.seed}</p> : null}
      {bankSupply}
      <span className="phase-chip whitespace-nowrap">{phaseLabel(game)}</span>
      {roomControls}
    </div>
    {infoHost === null || actionNotice !== null || victoryNotice !== null
      ? <ActionAttentionBanner notice={actionNotice} victoryNotice={victoryNotice} />
      : null}
  </>;

  return (
    <section className="board-shell" data-board-root="true" aria-label="游戏棋盘">
      {infoHost === null ? heading : createPortal(heading, infoHost)}
      <div className="board-stage" {...viewport.viewportProps}>
        <div className="board-transform" style={viewport.transformStyle}>
          <svg
            className="board-svg"
            viewBox={boardViewBox(game.map)}
            role="img"
            aria-label={game.map.hexes.length === 19
              ? "由十九块六边形地形组成的游戏棋盘"
              : "由三十块六边形地形组成的游戏棋盘"}
          >
          <defs>
            <filter id="tile-shadow" x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="5" stdDeviation="4" floodOpacity="0.22" />
            </filter>
          </defs>
          <BoardTerrain map={game.map} />
          <BoardPorts map={game.map} />
          <g className="robber-layer" aria-label="强盗位置与可选目的地">
            {robberHex === undefined ? null : (
              <g
                className="robber-piece"
                data-robber-piece="true"
                data-robber-hex-id={robberHex.id}
                transform={`translate(${axialToPixel(robberHex.q, robberHex.r).x + ROBBER_OFFSET.x} ${axialToPixel(robberHex.q, robberHex.r).y + ROBBER_OFFSET.y})`}
                role="img"
                aria-label={`强盗位于${terrainLabel(robberHex.terrain)}`}
              >
                <title>{`强盗位于${terrainLabel(robberHex.terrain)}`}</title>
                <ellipse className="robber-shadow" cy="16" rx="13" ry="5" />
                <path className="robber-body" d="M-12 13Q-10-1-5-5Q0-8 5-5Q10-1 12 13Q0 18-12 13Z" />
                <circle className="robber-head" cy="-10" r="6" />
                <path className="robber-highlight" d="M-6-2Q0-6 6-2M-7 4Q0 1 7 4" />
              </g>
            )}
            {game.interaction.kind !== "robber" ? null : game.interaction.targets.map((target) => {
              const hex = game.map.hexes.find((candidate) => candidate.id === target.hexId);
              if (hex === undefined) return null;
              const center = axialToPixel(hex.q, hex.r);
              const selected = target.hexId === selectedRobberHexId;
              const activate = () => {
                if (!busy) onRobberHexSelect?.(target.hexId);
              };
              return (
                <g
                  className={selected ? "robber-target is-selected" : "robber-target"}
                  data-robber-target={target.hexId}
                  key={target.hexId}
                  transform={`translate(${center.x} ${center.y})`}
                  role="button"
                  tabIndex={busy ? -1 : 0}
                  aria-disabled={busy}
                  aria-label={`将强盗移动到${terrainLabel(hex.terrain)}${hex.numberToken === null ? "" : `，点数 ${hex.numberToken}`}`}
                  onClick={activate}
                  onKeyDown={(event) => activateOnKeyboard(event, activate)}
                >
                  <circle className="robber-target-hit" r="29" />
                  <circle className="robber-target-ring" r="16" />
                  <circle className="robber-target-dot" r="5" />
                </g>
              );
            })}
          </g>
          <g className="board-edges" aria-label="道路位置">
            {game.map.edges.map((edge) => {
              const [firstId, secondId] = edge.vertexIds;
              const first = game.map.vertices.find((vertex) => vertex.id === firstId);
              const second = game.map.vertices.find((vertex) => vertex.id === secondId);

              if (first === undefined || second === undefined) return null;

              return (
                <line
                  key={edge.id}
                  data-edge-id={edge.id}
                  x1={first.x * BOARD_HEX_SIZE}
                  y1={first.y * BOARD_HEX_SIZE}
                  x2={second.x * BOARD_HEX_SIZE}
                  y2={second.y * BOARD_HEX_SIZE}
                />
              );
            })}
          </g>
          <g className="board-vertices" aria-label="建筑位置">
            {game.map.vertices.map((vertex) => (
              <circle
                key={vertex.id}
                data-vertex-id={vertex.id}
                cx={vertex.x * BOARD_HEX_SIZE}
                cy={vertex.y * BOARD_HEX_SIZE}
                r="4.5"
              />
            ))}
          </g>
          <IntentFocusMarker game={game} vertexId={intentFocusVertexId} />
          <ConstructionTargets
            game={game}
            busy={busy}
            buildMode={buildMode}
            layer="roads"
            coordinateScale={BOARD_HEX_SIZE}
            onCommand={handleBoardCommand}
          />
          <g className="placed-roads" aria-label="已建道路">
            {game.roads.map((road) => {
              const edge = game.map.edges.find((candidate) => candidate.id === road.edgeId);
              if (edge === undefined) return null;
              const [firstId, secondId] = edge.vertexIds;
              const first = game.map.vertices.find((vertex) => vertex.id === firstId);
              const second = game.map.vertices.find((vertex) => vertex.id === secondId);
              const player = game.players.find((candidate) => candidate.id === road.ownerId);
              if (first === undefined || second === undefined || player === undefined) return null;
              return (
                <g
                  key={road.edgeId}
                  className={`piece-color-${player.color}`}
                  data-piece-kind="road"
                  data-piece-location={road.edgeId}
                  role="img"
                  aria-label={`${player.name}的道路`}
                >
                  <line className="piece-road-shadow" x1={first.x * BOARD_HEX_SIZE} y1={first.y * BOARD_HEX_SIZE + 2} x2={second.x * BOARD_HEX_SIZE} y2={second.y * BOARD_HEX_SIZE + 2} />
                  <line className="piece-road-body" x1={first.x * BOARD_HEX_SIZE} y1={first.y * BOARD_HEX_SIZE} x2={second.x * BOARD_HEX_SIZE} y2={second.y * BOARD_HEX_SIZE} />
                  <line className="piece-road-shine" x1={first.x * BOARD_HEX_SIZE} y1={first.y * BOARD_HEX_SIZE - 1.5} x2={second.x * BOARD_HEX_SIZE} y2={second.y * BOARD_HEX_SIZE - 1.5} />
                </g>
              );
            })}
          </g>
          <g className="placed-buildings" aria-label="已建建筑">
            {game.buildings.map((building) => {
              const vertex = game.map.vertices.find((candidate) => candidate.id === building.vertexId);
              const player = game.players.find((candidate) => candidate.id === building.ownerId);
              if (vertex === undefined || player === undefined) return null;
              return (
                <g
                  key={building.vertexId}
                  className={`piece-color-${player.color}`}
                  data-piece-kind={building.kind}
                  data-vertex-id={building.vertexId}
                  data-piece-location={building.vertexId}
                  transform={`translate(${vertex.x * BOARD_HEX_SIZE} ${vertex.y * BOARD_HEX_SIZE})`}
                  role="img"
                  aria-label={`${player.name}的${building.kind === "city" ? "城市" : "村庄"}`}
                >
                  <title>{player.name}的{building.kind === "city" ? "城市" : "村庄"}</title>
                  {building.kind === "settlement" ? (
                    <>
                      <path className="piece-building-shadow" d="M-11 9V-5L0-14L11-5V9Z" transform="translate(0 2)" />
                      <path className="piece-building-body" d="M-11 9V-5L0-14L11-5V9Z" />
                      <path className="piece-building-shine" d="M-8-4L0-11L8-4" />
                      <rect className="piece-building-door" x="-2.5" y="2" width="5" height="7" rx="1" />
                    </>
                  ) : (
                    <>
                      <path className="piece-building-shadow" d="M-15 10V-5H-9V-13H1V-6H8L14-12L18-6V10Z" transform="translate(0 2)" />
                      <path className="piece-building-body" d="M-15 10V-5H-9V-13H1V-6H8L14-12L18-6V10Z" />
                      <path className="piece-building-shine" d="M-12-3H-7V-10H-1M9-4L14-9L17-5" />
                      <rect className="piece-building-door" x="-4" y="1" width="6" height="9" rx="1" />
                      <rect className="piece-building-window" x="8" y="1" width="4" height="4" rx=".7" />
                    </>
                  )}
                </g>
              );
            })}
          </g>
          <ConstructionTargets
            game={game}
            busy={busy}
            buildMode={buildMode}
            layer="buildings"
            coordinateScale={BOARD_HEX_SIZE}
            onCommand={handleBoardCommand}
          />
          </svg>
        </div>
        <BoardZoomControls {...viewport.zoom} />
      </div>
      {compact || infoHost !== null ? null : <div className="board-footer relative flex shrink-0 items-center justify-between gap-2">
        <p className="board-instruction flex-1" aria-live="polite">{boardInstruction(game, buildMode)}</p>
      </div>}
      <Dialog open={pendingRoadCommand !== null} onOpenChange={(open) => !open && setPendingRoadCommand(null)}>
        <DialogContent className="border-2 border-[#d0a853] bg-[#fff0cd] text-[#263f3b] shadow-[0_20px_60px_rgba(4,24,25,.58)] sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>确认道路位置</DialogTitle>
            <DialogDescription className="font-medium leading-6 text-[#53645d]">手机点选道路容易误触，请再次确认高亮位置。确认后会立即提交这次放置。</DialogDescription>
          </DialogHeader>
          <DialogFooter className="grid grid-cols-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={() => setPendingRoadCommand(null)}>返回重选</Button>
            <Button
              type="button"
              disabled={busy || pendingRoadCommand === null}
              onClick={() => {
                if (pendingRoadCommand === null) return;
                const command = pendingRoadCommand;
                setPendingRoadCommand(null);
                onCommand?.(command);
              }}
            >
              确认放置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function isRoadCommand(command: GameCommand): command is Extract<GameCommand, { type: "PlaceInitialRoad" | "BuildRoad" | "BuildFreeRoad" }> {
  return command.type === "PlaceInitialRoad" || command.type === "BuildRoad" || command.type === "BuildFreeRoad";
}

function shouldConfirmRoadOnThisDevice(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 820px)").matches;
}

function activateOnKeyboard(event: KeyboardEvent<SVGElement>, action: () => void): void {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

function boardInstruction(game: GameView, buildMode: BoardProps["buildMode"]): string {
  if (game.interaction.kind !== "turn-action") return game.interaction.instruction;
  if (buildMode === "road") return "请在地图上选择一条高亮边建造道路";
  if (buildMode === "settlement") return "请在地图上选择一个高亮顶点建造村庄";
  if (buildMode === "city") return "请在地图上选择一座高亮村庄升级为城市";
  return game.interaction.instruction;
}

function phaseLabel(game: GameView): string {
  if (game.phase.kind === "setup") {
    return `初始摆放 ${game.phase.placementIndex + 1}/${game.phase.placementOrder.length}`;
  }

  if (game.phase.kind === "turn") {
    return `第 ${game.phase.turnNumber} 回合`;
  }

  return "对局结束";
}

/**
 * A ring on the spot the AI intent read pointed at.
 *
 * Purely a pointer: it never takes clicks and never sits in the construction
 * layers, so it cannot be mistaken for somewhere the current player may build.
 * The label carries the road distance because "还差两条路" is the part that
 * makes the mark mean something at a glance.
 */
function IntentFocusMarker({ game, vertexId }: {
  readonly game: GameView;
  readonly vertexId: string | null;
}) {
  if (vertexId === null) return null;
  const vertex = game.map.vertices.find((candidate) => candidate.id === vertexId);
  if (vertex === undefined) return null;

  return (
    <g
      className="intent-focus"
      data-intent-focus-vertex={vertexId}
      transform={`translate(${vertex.x * BOARD_HEX_SIZE} ${vertex.y * BOARD_HEX_SIZE})`}
      aria-hidden="true"
    >
      <circle className="intent-focus-ring" r="11" />
      <circle className="intent-focus-dot" r="3.5" />
    </g>
  );
}
