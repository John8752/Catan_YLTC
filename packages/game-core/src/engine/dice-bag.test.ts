import { describe, expect, it } from "vitest";
import { createBalancedDiceBag, diceTotal } from "./dice-bag.js";

describe("balanced dice bag", () => {
  it("contains exactly two copies of every ordered two-die outcome", () => {
    const bag = createBalancedDiceBag(20260820, 0);
    const counts = new Map<string, number>();

    for (const dice of bag) {
      const key = dice.join("+");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    expect(bag).toHaveLength(72);
    for (let first = 1; first <= 6; first += 1) {
      for (let second = 1; second <= 6; second += 1) {
        expect(counts.get(`${first}+${second}`)).toBe(2);
      }
    }
  });

  it("keeps common totals available without creating equal-total triples", () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const first = createBalancedDiceBag(seed, 0);
      const second = createBalancedDiceBag(seed, 1, first);
      assertSequenceLimits([...first, ...second].map(diceTotal));
    }
  });
});

function assertSequenceLimits(totals: readonly number[]): void {
  expect(hasTriple(totals)).toBe(false);
  expect(maximumGap(totals, 6)).toBeLessThanOrEqual(18);
  expect(maximumGap(totals, 7)).toBeLessThanOrEqual(16);
  expect(maximumGap(totals, 8)).toBeLessThanOrEqual(18);
}

function hasTriple(values: readonly number[]): boolean {
  return values.some((value, index) => value === values[index - 1] && value === values[index - 2]);
}

function maximumGap(values: readonly number[], target: number): number {
  const positions = values.flatMap((value, index) => value === target ? [index] : []);
  let maximum = positions[0] ?? values.length;
  for (let index = 1; index < positions.length; index += 1) {
    maximum = Math.max(maximum, (positions[index] ?? 0) - (positions[index - 1] ?? 0) - 1);
  }
  return Math.max(maximum, values.length - 1 - (positions.at(-1) ?? -1));
}
