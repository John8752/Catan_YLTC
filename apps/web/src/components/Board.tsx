import type { GameCommand, GameView } from "@catan/protocol";
import type { KeyboardEvent } from "react";

const TERRAIN_LABELS = {
  brick: "砖土",
  lumber: "森林",
  wool: "牧场",
  grain: "麦田",
  ore: "矿山",
  desert: "荒漠",
} as const;

const HEX_SIZE = 56;

export interface BoardProps {
  readonly game: GameView;
  readonly busy?: boolean;
  readonly onCommand?: (command: GameCommand) => void;
  readonly buildMode?: "road" | "settlement" | "city" | null;
}

export function Board({ game, busy = false, onCommand, buildMode = null }: BoardProps) {
  const selectableVertices = new Set([
    ...game.interaction.vertexIds,
    ...(game.interaction.kind === "turn-action" && buildMode === "settlement" ? game.interaction.settlementVertexIds : []),
    ...(game.interaction.kind === "turn-action" && buildMode === "city" ? game.interaction.cityVertexIds : []),
  ]);
  const selectableEdges = new Set([
    ...game.interaction.edgeIds,
    ...(game.interaction.kind === "turn-action" && buildMode === "road" ? game.interaction.roadEdgeIds : []),
  ]);

  return (
    <section className="board-shell" data-board-root="true" aria-labelledby="board-title">
      <div className="board-heading">
        <div>
          <p className="eyebrow">种子 {game.seed}</p>
          <h2 id="board-title">群岛初现</h2>
        </div>
        <span className="phase-chip">{phaseLabel(game)}</span>
      </div>

      <div className="board-stage">
        <svg
          className="board-svg"
          viewBox="-310 -260 620 520"
          role="img"
          aria-label="由十九块六边形地形组成的游戏棋盘"
        >
          <defs>
            <filter id="tile-shadow" x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="5" stdDeviation="4" floodOpacity="0.22" />
            </filter>
          </defs>
          <g filter="url(#tile-shadow)">
            {game.map.hexes.map((tile) => {
              const center = axialToPixel(tile.q, tile.r);
              const label = TERRAIN_LABELS[tile.terrain];

              return (
                <g
                  key={tile.id}
                  className={`hex-tile terrain-${tile.terrain}`}
                  data-hex-id={tile.id}
                  transform={`translate(${center.x} ${center.y})`}
                  role="group"
                  aria-label={`${label}${tile.numberToken === null ? "" : `，点数 ${tile.numberToken}`}`}
                >
                  <polygon points={hexPoints(HEX_SIZE)} />
                  <text className="terrain-mark" y={tile.numberToken === null ? 7 : -11} textAnchor="middle">
                    {terrainMark(tile.terrain)}
                  </text>
                  {tile.numberToken === null ? null : (
                    <g className={tile.numberToken === 6 || tile.numberToken === 8 ? "token hot" : "token"}>
                      <circle cy="16" r="15" />
                      <text y="21" textAnchor="middle">
                        {tile.numberToken}
                      </text>
                    </g>
                  )}
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
                  className={selectableEdges.has(edge.id) ? "is-selectable" : undefined}
                  x1={first.x * HEX_SIZE}
                  y1={first.y * HEX_SIZE}
                  x2={second.x * HEX_SIZE}
                  y2={second.y * HEX_SIZE}
                  role={selectableEdges.has(edge.id) ? "button" : undefined}
                  tabIndex={selectableEdges.has(edge.id) ? 0 : undefined}
                  aria-label={selectableEdges.has(edge.id) ? "在这里放置道路" : undefined}
                  onClick={() => {
                    if (selectableEdges.has(edge.id) && !busy) {
                      onCommand?.(game.interaction.kind === "setup-road"
                        ? { type: "PlaceInitialRoad", edgeId: edge.id }
                        : game.interaction.kind === "free-road"
                          ? { type: "BuildFreeRoad", edgeId: edge.id }
                          : { type: "BuildRoad", edgeId: edge.id });
                    }
                  }}
                  onKeyDown={(event) => activateOnKeyboard(event, () => {
                    if (selectableEdges.has(edge.id) && !busy) {
                      onCommand?.(game.interaction.kind === "setup-road"
                        ? { type: "PlaceInitialRoad", edgeId: edge.id }
                        : game.interaction.kind === "free-road"
                          ? { type: "BuildFreeRoad", edgeId: edge.id }
                          : { type: "BuildRoad", edgeId: edge.id });
                    }
                  })}
                />
              );
            })}
          </g>
          <g className="board-vertices" aria-label="建筑位置">
            {game.map.vertices.map((vertex) => (
              <circle
                key={vertex.id}
                data-vertex-id={vertex.id}
                className={selectableVertices.has(vertex.id) ? "is-selectable" : undefined}
                cx={vertex.x * HEX_SIZE}
                cy={vertex.y * HEX_SIZE}
                r="4.5"
                role={selectableVertices.has(vertex.id) ? "button" : undefined}
                tabIndex={selectableVertices.has(vertex.id) ? 0 : undefined}
                aria-label={selectableVertices.has(vertex.id) ? "在这里放置定居点" : undefined}
                onClick={() => {
                  if (selectableVertices.has(vertex.id) && !busy) {
                    onCommand?.(game.interaction.kind === "setup-settlement"
                      ? { type: "PlaceInitialSettlement", vertexId: vertex.id }
                      : buildMode === "city"
                        ? { type: "BuildCity", vertexId: vertex.id }
                        : { type: "BuildSettlement", vertexId: vertex.id });
                  }
                }}
                onKeyDown={(event) => activateOnKeyboard(event, () => {
                  if (selectableVertices.has(vertex.id) && !busy) {
                    onCommand?.(game.interaction.kind === "setup-settlement"
                      ? { type: "PlaceInitialSettlement", vertexId: vertex.id }
                      : buildMode === "city"
                        ? { type: "BuildCity", vertexId: vertex.id }
                        : { type: "BuildSettlement", vertexId: vertex.id });
                  }
                })}
              />
            ))}
          </g>
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
                  role="img"
                  aria-label={`${player.name}的道路`}
                >
                  <line className="piece-road-shadow" x1={first.x * HEX_SIZE} y1={first.y * HEX_SIZE + 2} x2={second.x * HEX_SIZE} y2={second.y * HEX_SIZE + 2} />
                  <line className="piece-road-body" x1={first.x * HEX_SIZE} y1={first.y * HEX_SIZE} x2={second.x * HEX_SIZE} y2={second.y * HEX_SIZE} />
                  <line className="piece-road-shine" x1={first.x * HEX_SIZE} y1={first.y * HEX_SIZE - 1.5} x2={second.x * HEX_SIZE} y2={second.y * HEX_SIZE - 1.5} />
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
                  transform={`translate(${vertex.x * HEX_SIZE} ${vertex.y * HEX_SIZE})`}
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
          <g className="board-ports" aria-label="港口">
            {game.map.ports.map((port) => {
              const [firstId, secondId] = port.vertexIds;
              const first = game.map.vertices.find((vertex) => vertex.id === firstId);
              const second = game.map.vertices.find((vertex) => vertex.id === secondId);

              if (first === undefined || second === undefined) return null;
              const x = ((first.x + second.x) / 2) * HEX_SIZE * 1.14;
              const y = ((first.y + second.y) / 2) * HEX_SIZE * 1.14;
              const label = port.kind === "generic" ? "3:1" : `2:1 ${terrainMark(port.resource)}`;

              return (
                <g key={port.id} data-port-id={port.id} transform={`translate(${x} ${y})`}>
                  <circle r="15" />
                  <text y="4" textAnchor="middle">{label}</text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <p className="board-instruction" aria-live="polite">{game.interaction.instruction}</p>
    </section>
  );
}

function activateOnKeyboard(event: KeyboardEvent<SVGElement>, action: () => void): void {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

function axialToPixel(q: number, r: number) {
  return {
    x: HEX_SIZE * Math.sqrt(3) * (q + r / 2),
    y: HEX_SIZE * 1.5 * r,
  };
}

function hexPoints(size: number): string {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = ((60 * index - 30) * Math.PI) / 180;
    return `${size * Math.cos(angle)},${size * Math.sin(angle)}`;
  }).join(" ");
}

function terrainMark(terrain: GameView["map"]["hexes"][number]["terrain"]): string {
  return {
    brick: "▧",
    lumber: "♠",
    wool: "⌁",
    grain: "≋",
    ore: "◆",
    desert: "☀",
  }[terrain];
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
