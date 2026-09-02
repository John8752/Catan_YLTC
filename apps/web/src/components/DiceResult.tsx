import type { GameView } from "@catan/protocol";

/** Pip positions on a unit square, in the order a die shows them. */
const PIPS: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.28, 0.24], [0.72, 0.24], [0.28, 0.5], [0.72, 0.5], [0.28, 0.76], [0.72, 0.76]],
};

/**
 * The roll, where the table looks after someone throws.
 *
 * It used to be a chip in the local player's dock, which is the one place the
 * other five seats are not watching.
 */
export function DiceResult({ roll }: { readonly roll: GameView["lastRoll"] }) {
  if (roll === null) return null;
  const [first, second] = roll;

  return (
    <div className="board-dice-result" role="status" aria-label={`骰子：${first} + ${second}`}>
      <span className="board-dice-faces" aria-hidden="true">
        <DieFace value={first} />
        <DieFace value={second} />
      </span>
      <strong className="board-dice-total" aria-hidden="true">{first + second}</strong>
    </div>
  );
}

function DieFace({ value }: { readonly value: number }) {
  return (
    <svg className="board-die" viewBox="0 0 100 100" aria-hidden="true">
      <rect className="board-die-body" x="4" y="4" width="92" height="92" rx="20" />
      {(PIPS[value] ?? []).map(([x, y], index) => (
        <circle className="board-die-pip" key={index} cx={x * 100} cy={y * 100} r="9" />
      ))}
    </svg>
  );
}
