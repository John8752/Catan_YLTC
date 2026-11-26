import { Group } from "three";
import { unregisteredGame, type GameType } from "@catan/protocol/platform";
import { makeLobbyModel as island } from "./games/catan/lobby-model.js";
import { makeLobbyModel as drawing } from "./games/draw-guess/lobby-model.js";
import { makeLobbyModel as race } from "./games/camel-up/lobby-model.js";
import { makeLobbyModel as landscape } from "./games/carcassonne/lobby-model.js";
import { makeLobbyModel as poker } from "./games/texas-holdem/lobby-model.js";

/** Presentation-only dispatch; these small models import no game engine. */
export function buildModel(gameId: GameType, waiting = false) {
  const world = new Group();
  switch (gameId) {
    case "catan": return { world, detail: island(world) };
    case "draw-guess": return { world, detail: drawing(world) };
    case "camel-up": return { world, detail: race(world) };
    case "carcassonne": return { world, detail: landscape(world) };
    case "texas-holdem": return { world, detail: poker(world, waiting) };
    default: return unregisteredGame(gameId);
  }
}
