export type DevelopmentCardType =
  | "knight"
  | "victory-point"
  | "road-building"
  | "monopoly"
  | "resource-choice";

export interface DevelopmentCardState {
  readonly id: string;
  readonly type: DevelopmentCardType;
  readonly acquiredTurn: number;
}
