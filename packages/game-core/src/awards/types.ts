import type { PlayerId } from "../primitives/index.js";

export interface AwardHolderState {
  readonly holderId: PlayerId | null;
  readonly value: number;
}

export interface AwardsState {
  readonly longestRoad: AwardHolderState;
  readonly largestArmy: AwardHolderState;
}

export function emptyAwards(): AwardsState {
  return {
    longestRoad: { holderId: null, value: 0 },
    largestArmy: { holderId: null, value: 0 },
  };
}
