export interface TurnTimerView {
  readonly playerId: string;
  readonly kind: "roll" | "action";
  readonly durationMs: number;
  readonly deadlineAt: number;
  readonly serverNow: number;
}
