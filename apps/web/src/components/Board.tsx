import type { GameView } from "@catan/protocol";

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
}

export function Board({ game }: BoardProps) {
  return (
    <section className="board-shell" aria-labelledby="board-title">
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
            {game.board.map((tile) => {
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
        </svg>
      </div>
    </section>
  );
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

function terrainMark(terrain: GameView["board"][number]["terrain"]): string {
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
