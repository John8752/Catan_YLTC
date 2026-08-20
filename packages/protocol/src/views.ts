import {
  resourceCardCount,
  legalInitialRoadEdges,
  legalInitialSettlementVertices,
  type BuildingState,
  type GamePhase,
  type GameState,
  type GameMap,
  type PlayerColor,
  type ResourceHand,
  type RoadState,
  type RuleProfile,
} from "@catan/game-core";

export interface PublicPlayerView {
  readonly id: string;
  readonly name: string;
  readonly color: PlayerColor;
  readonly visibleVictoryPoints: number;
  readonly resourceCardCount: number;
  readonly remainingPieces: {
    readonly roads: number;
    readonly settlements: number;
    readonly cities: number;
  };
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
  readonly buildings: readonly BuildingState[];
  readonly roads: readonly RoadState[];
  readonly players: readonly PublicPlayerView[];
  readonly phase: GamePhase;
  readonly you: PrivatePlayerView;
  readonly interaction: GameInteractionView;
}

export type GameInteractionView =
  | {
      readonly kind: "setup-settlement";
      readonly instruction: string;
      readonly vertexIds: readonly string[];
      readonly edgeIds: readonly [];
    }
  | {
      readonly kind: "setup-road";
      readonly instruction: string;
      readonly vertexIds: readonly [];
      readonly edgeIds: readonly string[];
    }
  | {
      readonly kind: "waiting";
      readonly instruction: string;
      readonly vertexIds: readonly [];
      readonly edgeIds: readonly [];
    };

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
    remainingPieces: { ...player.pieces },
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
    buildings: state.buildings,
    roads: state.roads,
    players,
    phase: state.phase,
    you: {
      ...publicViewer,
      resources: { ...viewer.resources },
    },
    interaction: projectInteraction(state, viewerId),
  };
}

function projectInteraction(state: GameState, viewerId: string): GameInteractionView {
  if (state.phase.kind !== "setup") {
    return { kind: "waiting", instruction: "等待当前玩家行动", vertexIds: [], edgeIds: [] };
  }

  const actorId = state.phase.placementOrder[state.phase.placementIndex];
  if (actorId !== viewerId) {
    const actor = state.players.find((player) => player.id === actorId);
    return {
      kind: "waiting",
      instruction: `等待 ${actor?.name ?? "其他玩家"} 完成初始摆放`,
      vertexIds: [],
      edgeIds: [],
    };
  }

  return state.phase.step === "settlement"
    ? {
        kind: "setup-settlement",
        instruction: "请选择一个高亮交叉点放置定居点",
        vertexIds: legalInitialSettlementVertices(state, viewerId),
        edgeIds: [],
      }
    : {
        kind: "setup-road",
        instruction: "请选择一条相邻高亮边放置道路",
        vertexIds: [],
        edgeIds: legalInitialRoadEdges(state, viewerId),
      };
}
