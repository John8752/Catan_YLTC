import { CamelError, CRAZY_CAMELS, RACING_CAMELS, type Camel, type CamelState, type RacingCamel, type RollInput } from "./types.js";
export const isRacer = (camel: Camel): camel is RacingCamel => (RACING_CAMELS as readonly string[]).includes(camel);
export function locate(state: CamelState, camel: Camel) {
  for (const [space, stack] of Object.entries(state.stacks)) {
    const index = stack.indexOf(camel); if (index >= 0) return { space: Number(space), index, stack };
  }
  throw new CamelError("INVALID_STATE", "赛道缺少骆驼");
}
export function rankCamels(state: CamelState): RacingCamel[] {
  return Object.entries(state.stacks).sort(([a], [b]) => Number(b) - Number(a)).flatMap(([, stack]) => [...stack].reverse().filter(isRacer));
}
function crazyForRoll(state: CamelState, choice: "black" | "white"): Camel {
  const positions = CRAZY_CAMELS.map(c => ({ camel: c, ...locate(state, c) }));
  // Adjacent crazy pieces always split: move the upper one, never the lower one.
  if (positions[0]!.space === positions[1]!.space && Math.abs(positions[0]!.index - positions[1]!.index) === 1)
    return positions[0]!.index > positions[1]!.index ? "black" : "white";
  const carrying = positions.filter(p => p.stack.slice(p.index + 1).some(isRacer));
  return carrying.length === 1 ? carrying[0]!.camel : choice;
}
/** Mutates only the cloned next state owned by executeCamelUp. */
export function moveCamel(state: CamelState, roll: RollInput): boolean {
  const camel = roll.die === "grey" ? crazyForRoll(state, roll.crazy) : roll.die;
  const { space: from, index, stack } = locate(state, camel);
  const moving = stack.splice(index); if (!stack.length) delete state.stacks[from];
  const direction = isRacer(camel) ? 1 : -1;
  let to = from + direction * roll.value, underneath = false;
  // A finish crossing interrupts movement, before any further tile action.
  if (to >= 1 && to <= 16) {
    const tile = state.tiles.find(t => t.space === to);
    if (tile) {
      state.players.find(p => p.id === tile.playerId)!.coins++;
      underneath = tile.side === "boo";
      to += direction * (underneath ? -1 : 1);
    }
  }
  const destination = state.stacks[to] ?? [];
  state.stacks[to] = underneath ? [...moving, ...destination] : [...destination, ...moving];
  state.lastRoll = { ...roll, camel, from, to };
  return to > 16 || to < 1;
}
