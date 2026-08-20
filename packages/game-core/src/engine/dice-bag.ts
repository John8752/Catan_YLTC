import { createSeededRandom, shuffled } from "../primitives/index.js";

export type DiceRoll = readonly [number, number];

export interface BalancedDiceBagState {
  readonly rolls: readonly DiceRoll[];
  readonly cursor: number;
  readonly cycle: number;
}

const DICE_BAG_CANDIDATES = 160;
const COMPLETE_DOUBLE_DICE_BAG: readonly DiceRoll[] = Array.from({ length: 2 }, () =>
  Array.from({ length: 6 }, (_, first) =>
    Array.from({ length: 6 }, (_, second): DiceRoll => [first + 1, second + 1]),
  ).flat(),
).flat();

export function createBalancedDiceBag(
  seed: number,
  cycle: number,
  previousRolls: readonly DiceRoll[] = [],
): readonly DiceRoll[] {
  let best: readonly DiceRoll[] | undefined;
  let bestPenalty = Number.POSITIVE_INFINITY;

  for (let candidateIndex = 0; candidateIndex < DICE_BAG_CANDIDATES; candidateIndex += 1) {
    const random = createSeededRandom(deriveSeed(seed, cycle, candidateIndex));
    const candidate = shuffled(COMPLETE_DOUBLE_DICE_BAG, random);
    const penalty = sequencePenalty([...previousRolls.slice(-18), ...candidate]);
    if (penalty < bestPenalty) {
      best = candidate;
      bestPenalty = penalty;
    }
    if (penalty === 0) break;
  }

  if (best === undefined) throw new Error("Unable to create balanced dice bag");
  return best;
}

export function createInitialDiceBag(seed: number): BalancedDiceBagState {
  return { rolls: createBalancedDiceBag(seed, 0), cursor: 0, cycle: 0 };
}

export function drawBalancedDice(
  seed: number,
  state: BalancedDiceBagState,
): { readonly dice: DiceRoll; readonly state: BalancedDiceBagState } {
  if (state.cursor < state.rolls.length) {
    const dice = state.rolls[state.cursor];
    if (dice === undefined) throw new Error("Dice bag cursor escaped the bag");
    return { dice, state: { ...state, cursor: state.cursor + 1 } };
  }

  const cycle = state.cycle + 1;
  const rolls = createBalancedDiceBag(seed, cycle, state.rolls);
  const dice = rolls[0];
  if (dice === undefined) throw new Error("Balanced dice bag is empty");
  return { dice, state: { rolls, cursor: 1, cycle } };
}

export function diceTotal(dice: DiceRoll): number {
  return dice[0] + dice[1];
}

function sequencePenalty(rolls: readonly DiceRoll[]): number {
  const totals = rolls.map(diceTotal);
  let penalty = 0;

  for (let index = 2; index < totals.length; index += 1) {
    if (totals[index] === totals[index - 1] && totals[index] === totals[index - 2]) penalty += 100_000;
  }

  penalty += gapPenalty(totals, 6, 18);
  penalty += gapPenalty(totals, 7, 16);
  penalty += gapPenalty(totals, 8, 18);

  for (let start = 0; start <= totals.length - 8; start += 1) {
    for (const target of [6, 7, 8]) {
      const count = totals.slice(start, start + 8).filter((total) => total === target).length;
      if (count > 3) penalty += (count - 3) * 20;
    }
  }

  return penalty;
}

function gapPenalty(totals: readonly number[], target: number, maximumGap: number): number {
  const positions = totals.flatMap((total, index) => total === target ? [index] : []);
  if (positions.length === 0) return 100_000;
  let penalty = Math.max(0, (positions[0] ?? 0) - maximumGap) ** 2 * 100_000;
  for (let index = 1; index < positions.length; index += 1) {
    const gap = (positions[index] ?? 0) - (positions[index - 1] ?? 0) - 1;
    penalty += Math.max(0, gap - maximumGap) ** 2 * 100_000;
  }
  const tailGap = totals.length - 1 - (positions.at(-1) ?? -1);
  return penalty + Math.max(0, tailGap - maximumGap) ** 2 * 100_000;
}

function deriveSeed(seed: number, cycle: number, candidateIndex: number): number {
  let value = seed ^ Math.imul(cycle + 1, 0x6d2b79f5) ^ Math.imul(candidateIndex + 1, 0x9e3779b1);
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return (value ^ (value >>> 15)) >>> 0;
}
