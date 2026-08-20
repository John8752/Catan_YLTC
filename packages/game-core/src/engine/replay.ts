import type { PlayerId, RandomSource } from "../primitives/index.js";
import type { GameCommand, GameEvent } from "./commands.js";
import { executeGameCommand } from "./execute.js";
import type { GameState } from "./state.js";

export interface RecordedCommand {
  readonly actorId: PlayerId;
  readonly command: GameCommand;
  readonly randomValues?: readonly number[];
}

export interface ReplayResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export function replayRecordedCommands(
  initialState: GameState,
  commands: readonly RecordedCommand[],
): ReplayResult {
  let state = initialState;
  const events: GameEvent[] = [];

  for (const recorded of commands) {
    const result = executeGameCommand(
      state,
      recorded.actorId,
      recorded.command,
      sequenceRandom(recorded.randomValues ?? []),
    );
    if (!result.accepted) {
      throw new Error(`Replay rejected ${recorded.command.type}: ${result.error.code}`);
    }
    state = result.state;
    events.push(...result.events);
  }

  return { state, events };
}

function sequenceRandom(values: readonly number[]): RandomSource {
  let index = 0;
  return { next: () => values[index++] ?? 0 };
}
