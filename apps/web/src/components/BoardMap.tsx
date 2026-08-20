import type { GameView } from "@catan/protocol";

export const BOARD_HEX_SIZE = 56;

type GameMapView = GameView["map"];
type Terrain = GameMapView["hexes"][number]["terrain"];

const TERRAIN_LABELS: Record<Terrain, string> = {
  brick: "砖土",
  lumber: "森林",
  wool: "牧场",
  grain: "麦田",
  ore: "矿山",
  desert: "荒漠",
};

export interface BoardMapProps {
  readonly map: GameMapView;
  readonly hexSize?: number;
}

export function BoardTerrain({ map, hexSize = BOARD_HEX_SIZE }: BoardMapProps) {
  return (
    <g filter="url(#tile-shadow)">
      {map.hexes.map((tile) => {
        const center = axialToPixel(tile.q, tile.r, hexSize);

        return (
          <g
            key={tile.id}
            className={`hex-tile terrain-${tile.terrain}`}
            data-hex-id={tile.id}
            transform={`translate(${center.x} ${center.y})`}
            role="group"
            aria-label={`${terrainLabel(tile.terrain)}${tile.numberToken === null ? "" : `，点数 ${tile.numberToken}`}`}
          >
            <g className="hex-content">
              <polygon points={hexPoints(hexSize)} />
              <text className="terrain-mark" y={tile.numberToken === null ? 7 : -11} textAnchor="middle">
                {terrainMark(tile.terrain)}
              </text>
              {tile.numberToken === null ? null : (
                <g className={tile.numberToken === 6 || tile.numberToken === 8 ? "token hot" : "token"}>
                  <circle cy="16" r="15" />
                  <text y="21" textAnchor="middle">{tile.numberToken}</text>
                </g>
              )}
            </g>
          </g>
        );
      })}
    </g>
  );
}

export function BoardPorts({ map, hexSize = BOARD_HEX_SIZE }: BoardMapProps) {
  return (
    <g className="board-ports" aria-label="港口">
      {map.ports.map((port) => {
        const [firstId, secondId] = port.vertexIds;
        const first = map.vertices.find((vertex) => vertex.id === firstId);
        const second = map.vertices.find((vertex) => vertex.id === secondId);
        if (first === undefined || second === undefined) return null;

        const x = ((first.x + second.x) / 2) * hexSize * 1.14;
        const y = ((first.y + second.y) / 2) * hexSize * 1.14;
        const label = port.kind === "generic" ? "3:1" : `2:1 ${terrainMark(port.resource)}`;

        return (
          <g key={port.id} data-port-id={port.id} transform={`translate(${x} ${y})`}>
            <circle r="15" />
            <text y="4" textAnchor="middle">{label}</text>
          </g>
        );
      })}
    </g>
  );
}

export function axialToPixel(q: number, r: number, hexSize = BOARD_HEX_SIZE) {
  return {
    x: hexSize * Math.sqrt(3) * (q + r / 2),
    y: hexSize * 1.5 * r,
  };
}

export function terrainMark(terrain: Terrain): string {
  return {
    brick: "▧",
    lumber: "♠",
    wool: "⌁",
    grain: "≋",
    ore: "◆",
    desert: "☀",
  }[terrain];
}

export function terrainLabel(terrain: Terrain): string {
  return TERRAIN_LABELS[terrain];
}

function hexPoints(size: number): string {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = ((60 * index - 30) * Math.PI) / 180;
    return `${size * Math.cos(angle)},${size * Math.sin(angle)}`;
  }).join(" ");
}
