export interface RandomSource {
  next(): number;
}

export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;

  return {
    next(): number {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    },
  };
}

export function shuffled<T>(values: readonly T[], random: RandomSource): T[] {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random.next() * (index + 1));
    const current = result[index];
    const swap = result[swapIndex];

    if (current === undefined || swap === undefined) {
      throw new Error("Shuffle index escaped the array bounds");
    }

    result[index] = swap;
    result[swapIndex] = current;
  }

  return result;
}
