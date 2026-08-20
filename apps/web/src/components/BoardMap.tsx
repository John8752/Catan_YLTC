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
        const probabilityPips = tile.numberToken === null ? 0 : diceProbabilityPips(tile.numberToken);

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
              {tile.terrain === "wool" ? (
                <WoolIcon
                  className="terrain-icon-wool"
                  dataAttribute="tile"
                  transform={`translate(0 ${tile.numberToken === null ? 0 : -13})`}
                />
              ) : (
                <text className="terrain-mark" y={tile.numberToken === null ? 7 : -11} textAnchor="middle">
                  {terrainMark(tile.terrain)}
                </text>
              )}
              {tile.numberToken === null ? null : (
                <g className={tile.numberToken === 6 || tile.numberToken === 8 ? "token hot" : "token"}>
                  <circle cy="16" r="17" />
                  <text className="token-number" y="16" textAnchor="middle">{tile.numberToken}</text>
                  <g
                    className="token-pips"
                    data-probability-pips={probabilityPips}
                    aria-hidden="true"
                  >
                    {Array.from({ length: probabilityPips }, (_, index) => (
                      <circle key={index} cx={(index - (probabilityPips - 1) / 2) * 3.5} cy="25.5" r="1.15" />
                    ))}
                  </g>
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
        const label = port.kind === "generic" ? "3:1" : "2:1";
        const accessibleLabel = port.kind === "generic" ? "通用港口，三换一" : `${terrainLabel(port.resource)}港口，二换一`;

        return (
          <g
            key={port.id}
            data-port-id={port.id}
            data-port-sign="true"
            data-port-resource={port.kind === "generic" ? "generic" : port.resource}
            transform={`translate(${x} ${y})`}
            role="img"
            aria-label={accessibleLabel}
          >
            <rect x={port.kind === "generic" ? -19 : -23} y="-12" width={port.kind === "generic" ? 38 : 46} height="24" rx="8" />
            <text className="port-ratio" x={port.kind === "generic" ? 0 : -6} y="4" textAnchor="middle">{label}</text>
            {port.kind === "generic" ? null : port.resource === "wool" ? (
              <WoolIcon className="port-resource-icon port-resource-icon-wool" transform="translate(13 0) scale(.42)" />
            ) : (
              <text className="port-resource-mark" x="14" y="5" textAnchor="middle">{terrainMark(port.resource)}</text>
            )}
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

export function diceProbabilityPips(numberToken: number): number {
  return 6 - Math.abs(7 - numberToken);
}

function WoolIcon({
  className,
  transform,
  dataAttribute,
}: {
  readonly className: string;
  readonly transform: string;
  readonly dataAttribute?: "tile";
}) {
  return (
    <g
      className={className}
      data-tile-resource-icon={dataAttribute === "tile" ? "wool" : undefined}
      transform={transform}
      aria-hidden="true"
    >
      <ellipse className="wool-body" cx="-2" cy="-1" rx="12" ry="7" />
      <circle className="wool-head" cx="10" cy="-4" r="4.8" />
      <path className="wool-ear" d="M11-7L16-10L15-4Z" />
      <path className="wool-legs" d="M-9 4V11M-2 5V11M5 4V11" />
      <circle className="wool-eye" cx="12" cy="-5" r="1" />
    </g>
  );
}

function hexPoints(size: number): string {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = ((60 * index - 30) * Math.PI) / 180;
    return `${size * Math.cos(angle)},${size * Math.sin(angle)}`;
  }).join(" ");
}
