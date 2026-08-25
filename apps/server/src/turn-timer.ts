import type { GameCommand, GameState } from "@catan/game-core";
import type { TurnTimerView } from "@catan/protocol";

export const ROLL_TIMEOUT_MS = 5_000;
export const ACTION_TIMEOUT_MS = 120_000;

export interface TurnTimerExpiry {
  readonly playerId: string;
  readonly command: Extract<GameCommand, { readonly type: "RollDice" | "EndTurn" }>;
}

interface TimerSpec extends TurnTimerExpiry {
  readonly key: string;
  readonly kind: TurnTimerView["kind"];
  readonly durationMs: number;
}

interface ActiveTimer extends TimerSpec {
  readonly deadlineAt: number;
  readonly handle: ReturnType<typeof setTimeout>;
}

export class TurnTimerManager {
  private readonly timers = new Map<string, ActiveTimer>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  sync(roomId: string, game: GameState, onExpire: (expiry: TurnTimerExpiry) => void): void {
    const spec = timerSpec(game);
    const current = this.timers.get(roomId);
    if (spec === null) {
      this.clear(roomId);
      return;
    }
    if (current?.key === spec.key) return;
    this.clear(roomId);

    const deadlineAt = this.now() + spec.durationMs;
    const handle = setTimeout(() => {
      const active = this.timers.get(roomId);
      if (active?.key !== spec.key) return;
      this.timers.delete(roomId);
      onExpire({ playerId: spec.playerId, command: spec.command });
    }, spec.durationMs);
    handle.unref?.();
    this.timers.set(roomId, { ...spec, deadlineAt, handle });
  }

  view(roomId: string): TurnTimerView | null {
    const timer = this.timers.get(roomId);
    if (timer === undefined) return null;
    return {
      playerId: timer.playerId,
      kind: timer.kind,
      durationMs: timer.durationMs,
      deadlineAt: timer.deadlineAt,
      serverNow: this.now(),
    };
  }

  clear(roomId: string): void {
    const timer = this.timers.get(roomId);
    if (timer === undefined) return;
    clearTimeout(timer.handle);
    this.timers.delete(roomId);
  }

  dispose(): void {
    for (const roomId of this.timers.keys()) this.clear(roomId);
  }
}

function timerSpec(game: GameState): TimerSpec | null {
  if (game.phase.kind !== "turn") return null;
  const { activePlayerId, step, turnNumber } = game.phase;
  if (step === "roll") {
    return {
      key: `${turnNumber}:${activePlayerId}:roll`,
      playerId: activePlayerId,
      kind: "roll",
      durationMs: ROLL_TIMEOUT_MS,
      command: { type: "RollDice" },
    };
  }
  if (step === "action" || step === "paired-action") {
    return {
      key: `${turnNumber}:${activePlayerId}:${step}`,
      playerId: activePlayerId,
      kind: "action",
      durationMs: ACTION_TIMEOUT_MS,
      command: { type: "EndTurn" },
    };
  }
  return null;
}
