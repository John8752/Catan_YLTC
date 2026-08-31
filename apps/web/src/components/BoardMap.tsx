import type { GameView } from "@catan/protocol";
import { ResourceIcon } from "./ResourceIcon.js";

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

export function boardViewBox(map: GameMapView): string {
  // Fit the actual renderer bounds, including signs and a safe margin for pieces
  // and target rings. A fixed profile box wastes width and can crop outer ports.
  const points = map.hexes.flatMap((hex) => {
    const center = axialToPixel(hex.q, hex.r);
    return [
      { x: center.x - BOARD_HEX_SIZE * Math.sqrt(3) / 2, y: center.y - BOARD_HEX_SIZE },
      { x: center.x + BOARD_HEX_SIZE * Math.sqrt(3) / 2, y: center.y + BOARD_HEX_SIZE },
    ];
  });
  for (const port of map.ports) {
    const first = map.vertices.find((vertex) => vertex.id === port.vertexIds[0]);
    const second = map.vertices.find((vertex) => vertex.id === port.vertexIds[1]);
    if (first === undefined || second === undefined) continue;
    const { sign } = portGeometry(first, second, BOARD_HEX_SIZE);
    points.push({ x: sign.x - 25, y: sign.y - 22 }, { x: sign.x + 25, y: sign.y + 15 });
  }
  const left = Math.min(...points.map((point) => point.x)) - 14;
  const top = Math.min(...points.map((point) => point.y)) - 14;
  const right = Math.max(...points.map((point) => point.x)) + 14;
  const bottom = Math.max(...points.map((point) => point.y)) + 14;
  return `${left} ${top} ${right - left} ${bottom - top}`;
}

export function BoardTerrain({ map, hexSize = BOARD_HEX_SIZE }: BoardMapProps) {
  return (
    <g filter="url(#tile-shadow)">
      <TerrainGradients />
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
              <polygon className="hex-surface" points={hexPoints(hexSize)} />
              <polygon className="hex-inset" points={hexPoints(hexSize - 5)} />
              <ResourceIcon
                kind={tile.terrain}
                context="tile"
                className="terrain-icon"
                transform={tile.numberToken === null ? "translate(0 0) scale(1.12)" : "translate(0 -23) scale(.86)"}
              />
              {tile.numberToken === null ? null : (
                <g className={tile.numberToken === 6 || tile.numberToken === 8 ? "token hot" : "token"}>
                  <circle cy="17" r="21" />
                  <text className="token-number" y="23" textAnchor="middle">{tile.numberToken}</text>
                  <g
                    className="token-pips"
                    data-probability-pips={probabilityPips}
                    aria-hidden="true"
                  >
                    {Array.from({ length: probabilityPips }, (_, index) => (
                      <circle key={index} cx={(index - (probabilityPips - 1) / 2) * 4} cy="31" r="1.3" />
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

        const geometry = portGeometry(first, second, hexSize);
        const label = port.kind === "generic" ? "3:1" : "2:1";
        const accessibleLabel = port.kind === "generic"
          ? "通用港口，三换一，连接两个沿海交点"
          : `${terrainLabel(port.resource)}港口，二换一，连接两个沿海交点`;

        return (
          <g
            key={port.id}
            data-port-id={port.id}
            data-port-sign="true"
            data-port-resource={port.kind === "generic" ? "generic" : port.resource}
            role="img"
            aria-label={accessibleLabel}
          >
            <g className="port-coast-link" data-port-link="true">
              <line className="port-coast-shadow" x1={geometry.first.x} y1={geometry.first.y} x2={geometry.second.x} y2={geometry.second.y} />
              <line className="port-coast-deck" x1={geometry.first.x} y1={geometry.first.y} x2={geometry.second.x} y2={geometry.second.y} />
              <line className="port-pier-shadow" x1={geometry.first.x} y1={geometry.first.y} x2={geometry.firstAttach.x} y2={geometry.firstAttach.y} />
              <line className="port-pier-shadow" x1={geometry.second.x} y1={geometry.second.y} x2={geometry.secondAttach.x} y2={geometry.secondAttach.y} />
              <line className="port-pier-deck" x1={geometry.first.x} y1={geometry.first.y} x2={geometry.firstAttach.x} y2={geometry.firstAttach.y} />
              <line className="port-pier-deck" x1={geometry.second.x} y1={geometry.second.y} x2={geometry.secondAttach.x} y2={geometry.secondAttach.y} />
              <circle className="port-endpoint-halo" data-port-endpoint={firstId} cx={geometry.first.x} cy={geometry.first.y} r="7" />
              <circle className="port-endpoint-halo" data-port-endpoint={secondId} cx={geometry.second.x} cy={geometry.second.y} r="7" />
            </g>
            <g className="port-sign" transform={`translate(${geometry.sign.x} ${geometry.sign.y})`}>
              <path className="port-sign-crown" d="M-9-13Q0-22 9-13Z" />
              <rect x="-24" y="-13" width="48" height="26" rx="8" />
              <text className="port-ratio" x={port.kind === "generic" ? 0 : -7} y="4" textAnchor="middle">{label}</text>
              {port.kind === "generic" ? null : (
                <ResourceIcon kind={port.resource} context="port" className="port-resource-icon" transform="translate(13 0) scale(.43)" />
              )}
            </g>
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

export function terrainLabel(terrain: Terrain): string {
  return TERRAIN_LABELS[terrain];
}

export function diceProbabilityPips(numberToken: number): number {
  return 6 - Math.abs(7 - numberToken);
}

function TerrainGradients() {
  return (
    <defs>
      <linearGradient id="terrain-brick-fill" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#c96e50" /><stop offset="1" stopColor="#914330" /></linearGradient>
      <linearGradient id="terrain-lumber-fill" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#57905e" /><stop offset="1" stopColor="#285a39" /></linearGradient>
      <linearGradient id="terrain-wool-fill" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a5bd7d" /><stop offset="1" stopColor="#688a52" /></linearGradient>
      <linearGradient id="terrain-grain-fill" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e3bd55" /><stop offset="1" stopColor="#b6852b" /></linearGradient>
      <linearGradient id="terrain-ore-fill" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#84969b" /><stop offset="1" stopColor="#53666d" /></linearGradient>
      <linearGradient id="terrain-desert-fill" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ecd28e" /><stop offset="1" stopColor="#bd9250" /></linearGradient>
    </defs>
  );
}

function portGeometry(
  firstVertex: { readonly x: number; readonly y: number },
  secondVertex: { readonly x: number; readonly y: number },
  hexSize: number,
) {
  const first = { x: firstVertex.x * hexSize, y: firstVertex.y * hexSize };
  const second = { x: secondVertex.x * hexSize, y: secondVertex.y * hexSize };
  const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  const radius = Math.hypot(midpoint.x, midpoint.y) || 1;
  const outward = { x: midpoint.x / radius, y: midpoint.y / radius };
  const edgeLength = Math.hypot(second.x - first.x, second.y - first.y) || 1;
  const tangent = { x: (second.x - first.x) / edgeLength, y: (second.y - first.y) / edgeLength };
  const sign = { x: midpoint.x + outward.x * 39, y: midpoint.y + outward.y * 39 };
  const attachBase = { x: sign.x - outward.x * 13, y: sign.y - outward.y * 13 };

  return {
    first,
    second,
    sign,
    firstAttach: { x: attachBase.x - tangent.x * 10, y: attachBase.y - tangent.y * 10 },
    secondAttach: { x: attachBase.x + tangent.x * 10, y: attachBase.y + tangent.y * 10 },
  };
}

function hexPoints(size: number): string {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = ((60 * index - 30) * Math.PI) / 180;
    return `${size * Math.cos(angle)},${size * Math.sin(angle)}`;
  }).join(" ");
}
