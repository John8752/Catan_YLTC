import { projectHistoryRecord } from "./history-record.js";
import { projectHistoryPage, projectHistorySince, eventIndexAfter, type HistoryRange } from "./history.js";
import {
  RESOURCE_TYPES,
  type ResourceType,
  BUILD_COSTS,
  hasResources,
  longestRoadLength,
  resourceCardCount,
  legalInitialRoadEdges,
  legalInitialSettlementVertices,
  legalCityVertices,
  legalFreeRoadEdges,
  legalRoadEdges,
  legalRobberTargets,
  legalSettlementVertices,
  maritimeRatio,
  type BuildingState,
  type AwardsState,
  type DevelopmentCardState,
  type GamePhase,
  type GameEventRecord,
  type GameState,
  type GameMap,
  type PlayerColor,
  type ResourceHand,
  type RoadState,
  type TradeOfferState,
  turnOpportunityQueue,
  type TurnOpportunityKind,
  type RuleProfile,
  type PlayableRuleProfile,
} from "@catan/game-core";
import { projectPlayerSafeEffect, type PublicGameEffectView } from "./game-effects.js";
import { projectGameSummary, type GameSummaryView } from "./game-summary.js";
import type { TurnTimerView } from "./turn-timer.js";
import { projectActionAttention } from "./action-attention.js";
import { victoryWarningHistory, type VictoryWarningEffectView } from "./victory-warning.js";

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
  readonly developmentCardCount: number;
  readonly playedKnights: number;
  readonly longestRoadLength: number;
}

export interface PrivatePlayerView extends PublicPlayerView {
  readonly resources: ResourceHand;
  readonly maritimeRatios: Readonly<Record<ResourceType, 2 | 3 | 4>>;
  readonly developmentCards: readonly DevelopmentCardState[];
}

export interface GameView {
  readonly id: string;
  readonly ruleProfile: RuleProfile;
  readonly victoryPointsToWin: number;
  readonly seed: number;
  readonly revision: number;
  readonly map: GameMap;
  readonly buildings: readonly BuildingState[];
  readonly roads: readonly RoadState[];
  readonly players: readonly PublicPlayerView[];
  readonly phase: GamePhase;
  readonly lastRoll: readonly [number, number] | null;
  readonly bankResources: ResourceHand | null;
  readonly you: PrivatePlayerView;
  readonly interaction: GameInteractionView;
  readonly openTrade: TradeOfferState | null;
  readonly developmentDeckCount: number;
  readonly developmentCardPlayedThisTurn: boolean;
  readonly awards: AwardsState;
  readonly history: readonly GameHistoryEntryView[];
  readonly historyRange?: HistoryRange;
  readonly effects: readonly PublicGameEffectView[];
  readonly summary: GameSummaryView | null;
  readonly turnTimer: TurnTimerView | null;
  readonly turnQueue: readonly TurnQueueEntryView[];
}

export interface TurnQueueEntryView {
  readonly playerId: string;
  readonly kind: TurnOpportunityKind;
  readonly turnNumber: number;
}

export interface GameHistoryEntryView {
  /** Stable in indexed history pages/streams; omitted by legacy projections. */
  readonly id?: string;
  readonly revision: number;
  readonly type: string;
  readonly message: string;
  readonly privateDetail: string | null;
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
    }
  | {
      readonly kind: "turn-roll";
      readonly instruction: string;
      readonly vertexIds: readonly [];
      readonly edgeIds: readonly [];
    }
  | {
      readonly kind: "turn-action";
      readonly instruction: string;
      readonly vertexIds: readonly [];
      readonly edgeIds: readonly [];
      readonly roadEdgeIds: readonly string[];
      readonly settlementVertexIds: readonly string[];
      readonly cityVertexIds: readonly string[];
      readonly pairedPlayer: boolean;
    }
  | {
      readonly kind: "discard";
      readonly instruction: string;
      readonly requiredCount: number;
      readonly vertexIds: readonly [];
      readonly edgeIds: readonly [];
    }
  | {
      readonly kind: "robber";
      readonly instruction: string;
      readonly targets: readonly {
        readonly hexId: string;
        readonly victimIds: readonly string[];
      }[];
      readonly vertexIds: readonly [];
      readonly edgeIds: readonly [];
    }
  | {
      readonly kind: "trade-response";
      readonly instruction: string;
      readonly offerId: string;
      readonly vertexIds: readonly [];
      readonly edgeIds: readonly [];
    }
  | {
      readonly kind: "free-road";
      readonly instruction: string;
      readonly vertexIds: readonly [];
      readonly edgeIds: readonly string[];
    };

export interface LobbyMemberView {
  readonly id: string;
  readonly name: string;
  readonly color: PlayerColor;
  readonly isHost: boolean;
}

export interface RoomSettingsView {
  readonly ruleProfile: PlayableRuleProfile;
  /**
   * Derived from the rule profile, never chosen on its own: the profile is what
   * decides the map, the supplies and the turn policy, and the seat cap comes
   * with it. Kept in the view so a lobby can show "3/4" without knowing profiles.
   */
  readonly playerLimit: 4 | 6;
  readonly victoryPointsToWin: number;
  readonly mapSeed: number;
  readonly bankCountsPublic: boolean;
}

export interface PublicSetupPlayerCommentView {
  readonly playerId: string;
  readonly comment: string;
}

export interface PublicSetupAnalysisContent {
  readonly playerComments: readonly PublicSetupPlayerCommentView[];
  readonly predictedWinnerId: string;
  readonly prediction: string;
}

/** One player's read: where they look headed, and what is holding them up. */
export interface TableIntentPlayerView {
  readonly playerId: string;
  /** A site the server offered as reachable, never one the model invented. */
  readonly targetVertexId: string | null;
  readonly roadsNeeded: number | null;
  readonly intent: string;
  readonly blocker: string;
}

export interface TableIntentContent {
  readonly overview: string;
  readonly players: readonly TableIntentPlayerView[];
}

export type PublicSetupAnalysisView =
  | {
      readonly status: "loading";
      readonly sourceRevision: number;
    }
  | ({
      readonly status: "ready";
      readonly sourceRevision: number;
    } & PublicSetupAnalysisContent)
  | {
      readonly status: "failed";
      readonly sourceRevision: number;
      readonly message: string;
    };

export type RoomSettingsInput = Omit<RoomSettingsView, "mapSeed" | "playerLimit">;

export interface RoomView {
  readonly id: string;
  readonly revision: number;
  readonly hostPlayerId: string;
  readonly members: readonly LobbyMemberView[];
  readonly settings: RoomSettingsView;
  readonly previewMap: GameMap | null;
  readonly game: GameView | null;
  readonly setupAnalysis: PublicSetupAnalysisView | null;
}

/**
 * How many trailing event records a legacy full/map-cache-v1 projection carries.
 *
 * The complete log stays on the server for replay; a view only needs what a
 * player can meaningfully scroll back through. Without a cap the entire history
 * rides along on every room update, and since each accepted command pushes the
 * whole room to every seat, a long match ends up sending hundreds of kilobytes
 * per move to every player.
 * events-v2 uses a recent history page followed by cursor-based updates instead.
 */
export const MAX_PROJECTED_EVENT_RECORDS = 200;

export function projectGameForPlayer(
  state: GameState,
  viewerId: string,
  eventRecords: readonly GameEventRecord[] = [],
  turnTimer: TurnTimerView | null = null,
  visibility: Pick<RoomSettingsView, "bankCountsPublic"> = { bankCountsPublic: true },
  victoryWarnings: readonly VictoryWarningEffectView[] = [],
  eventAfterRevision?: number | null,
): GameView {
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
    developmentCardCount: player.developmentCards.length,
    playedKnights: player.playedKnights,
    longestRoadLength: longestRoadLength(state.map, state.buildings, state.roads, player.id),
  }));

  const publicViewer = players.find((player) => player.id === viewerId);

  if (publicViewer === undefined) {
    throw new Error(`Projected player ${viewerId} is missing`);
  }

  const recentRecords =
    eventRecords.length > MAX_PROJECTED_EVENT_RECORDS
      ? eventRecords.slice(-MAX_PROJECTED_EVENT_RECORDS)
      : eventRecords;
  const historyPage = eventAfterRevision === undefined ? null : eventAfterRevision === null
    ? projectHistoryPage(state, viewerId, eventRecords, victoryWarnings)
    : projectHistorySince(state, viewerId, eventRecords, victoryWarnings, eventAfterRevision);
  const effectRecords = eventAfterRevision === undefined ? recentRecords : eventAfterRevision === null
    ? [] : eventRecords.slice(eventIndexAfter(eventRecords, eventAfterRevision));
  const interaction = projectInteraction(state, viewerId);
  const recentWarnings = victoryWarnings.filter((warning) => warning.revision >= (recentRecords[0]?.revision ?? state.revision) && warning.revision <= state.revision);

  return {
    id: state.id,
    ruleProfile: state.ruleProfile,
    victoryPointsToWin: state.victoryPointsToWin,
    seed: state.seed,
    revision: state.revision,
    map: state.map,
    buildings: state.buildings,
    roads: state.roads,
    players,
    phase: state.phase,
    lastRoll: state.lastRoll,
    bankResources: visibility.bankCountsPublic ? { ...state.bank } : null,
    you: {
      ...publicViewer,
      resources: { ...viewer.resources },
      maritimeRatios: Object.fromEntries(
        RESOURCE_TYPES.map((resource) => [resource, maritimeRatio(state, viewerId, resource)]),
      ) as Record<ResourceType, 2 | 3 | 4>,
      developmentCards: viewer.developmentCards.map((card) => ({ ...card })),
    },
    interaction,
    openTrade: state.openTrade,
    developmentDeckCount: state.developmentDeck.length,
    developmentCardPlayedThisTurn: state.developmentCardPlayedThisTurn,
    awards: state.awards,
    ...(historyPage === null ? {} : { historyRange: historyPage.range }),
    history: historyPage?.entries ?? [...recentRecords.flatMap((record) => projectHistoryRecord(state, viewerId, record)), ...recentWarnings.map(victoryWarningHistory)].sort((a, b) => a.revision - b.revision),
    effects: [...effectRecords.flatMap((record) => projectPlayerSafeEffect(record, viewerId)), ...projectActionAttention(state, viewerId, interaction, eventRecords), ...(state.phase.kind === "turn" ? (eventAfterRevision === undefined ? recentWarnings : victoryWarnings.filter((warning) => eventAfterRevision !== null && warning.revision > eventAfterRevision)) : [])],
    summary: projectGameSummary(state, eventRecords),
    turnTimer,
    turnQueue: turnOpportunityQueue(state),
  };
}

function projectInteraction(state: GameState, viewerId: string): GameInteractionView {
  if (state.phase.kind === "turn") {
    if (state.phase.step === "discard") {
      const required = state.pendingDiscards.find((pending) => pending.playerId === viewerId);
      return required === undefined
        ? { kind: "waiting", instruction: "等待其他玩家弃牌", vertexIds: [], edgeIds: [] }
        : {
            kind: "discard",
            instruction: `请选择 ${required.count} 张资源弃回银行`,
            requiredCount: required.count,
            vertexIds: [],
            edgeIds: [],
          };
    }
    if (
      state.phase.step === "action" &&
      state.openTrade !== null &&
      state.openTrade.proposerId !== viewerId
    ) {
      return {
        kind: "trade-response",
        instruction: "当前玩家发来一份交易报价",
        offerId: state.openTrade.offerId,
        vertexIds: [],
        edgeIds: [],
      };
    }
    if (state.phase.activePlayerId !== viewerId) {
      const activePlayerId = state.phase.activePlayerId;
      const actor = state.players.find((player) => player.id === activePlayerId);
      const actorName = actor?.name ?? "当前玩家";
      return {
        kind: "waiting",
        instruction: state.phase.step === "robber"
          ? `等待 ${actorName} 移动强盗`
          : state.phase.step === "free-road"
            ? `等待 ${actorName} 放置免费道路`
            : `等待 ${actorName} 行动`,
        vertexIds: [],
        edgeIds: [],
      };
    }
    if (state.phase.step === "roll") {
      return { kind: "turn-roll", instruction: "轮到你了，请掷骰子", vertexIds: [], edgeIds: [] };
    }
    if (state.phase.step === "action" || state.phase.step === "paired-action") {
      const player = state.players.find((candidate) => candidate.id === viewerId);
      if (player === undefined) throw new Error(`Player ${viewerId} is missing`);
      return {
        kind: "turn-action",
        instruction: state.phase.step === "paired-action"
          ? "搭档行动：可与银行交易、建造、使用发展牌或结束行动"
          : "你可以交易、建造或结束回合",
        vertexIds: [],
        edgeIds: [],
        roadEdgeIds: player.pieces.roads > 0 && hasResources(player.resources, BUILD_COSTS.road)
          ? legalRoadEdges(state, viewerId)
          : [],
        settlementVertexIds: player.pieces.settlements > 0 && hasResources(player.resources, BUILD_COSTS.settlement)
          ? legalSettlementVertices(state, viewerId)
          : [],
        cityVertexIds: player.pieces.cities > 0 && hasResources(player.resources, BUILD_COSTS.city)
          ? legalCityVertices(state, viewerId)
          : [],
        pairedPlayer: state.phase.step === "paired-action",
      };
    }
    if (state.phase.step === "robber") {
      if (state.phase.activePlayerId !== viewerId) {
        return { kind: "waiting", instruction: "等待当前玩家移动强盗", vertexIds: [], edgeIds: [] };
      }
      return {
        kind: "robber",
        instruction: "移动强盗，并在可选时选择一名相邻玩家",
        targets: legalRobberTargets(state, viewerId),
        vertexIds: [],
        edgeIds: [],
      };
    }
    if (state.phase.step === "free-road") {
      return {
        kind: "free-road",
        instruction: `请选择免费道路（剩余 ${state.freeRoadsRemaining} 条）`,
        vertexIds: [],
        edgeIds: legalFreeRoadEdges(state, viewerId),
      };
    }
    return { kind: "waiting", instruction: "正在处理强制事件", vertexIds: [], edgeIds: [] };
  }

  if (state.phase.kind !== "setup") {
    return { kind: "waiting", instruction: "对局已经结束", vertexIds: [], edgeIds: [] };
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
