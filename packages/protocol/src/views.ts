import {
  resourceCardCount,
  type GamePhase,
  type GameState,
  type GameMap,
  type PlayerColor,
  type ResourceHand,
  type RuleProfile,
} from "@catan/game-core";

export interface PublicPlayerView {
  readonly id: string;
  readonly name: string;
  readonly color: PlayerColor;
  readonly visibleVictoryPoints: number;
  readonly resourceCardCount: number;
}

export interface PrivatePlayerView extends PublicPlayerView {
  readonly resources: ResourceHand;
}

export interface GameView {
  readonly id: string;
  readonly ruleProfile: RuleProfile;
  readonly seed: number;
  readonly revision: number;
  readonly map: GameMap;
  readonly players: readonly PublicPlayerView[];
  readonly phase: GamePhase;
  readonly you: PrivatePlayerView;
}

export interface LobbyMemberView {
  readonly id: string;
  readonly name: string;
  readonly color: PlayerColor;
  readonly isHost: boolean;
}

export interface RoomView {
  readonly id: string;
  readonly revision: number;
  readonly hostPlayerId: string;
  readonly members: readonly LobbyMemberView[];
  readonly game: GameView | null;
}

export function projectGameForPlayer(state: GameState, viewerId: string): GameView {
  const viewer = state.players.find((player) => player.id === viewerId);

  if (viewer === undefined) {
    throw new Error(`Player ${viewerId} does not belong to game ${state.id}`);
  }

  const players = state.players.map((player): PublicPlayerView => ({
    id: player.id,
    name: player.name,
    color: player.color,
    visibleVictoryPoints: player.visibleVictoryPoints,
    resourceCardCount: resourceCardCount(player.resources),
  }));

  const publicViewer = players.find((player) => player.id === viewerId);

  if (publicViewer === undefined) {
    throw new Error(`Projected player ${viewerId} is missing`);
  }

  return {
    id: state.id,
    ruleProfile: state.ruleProfile,
    seed: state.seed,
    revision: state.revision,
    map: state.map,
    players,
    phase: state.phase,
    you: {
      ...publicViewer,
      resources: { ...viewer.resources },
    },
  };
}
