import {
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
  RESOURCE_TYPES,
  type ResourceType,
  type TradeOfferState,
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
  readonly effects: readonly PublicGameEffectView[];
  readonly summary: GameSummaryView | null;
  readonly turnTimer: TurnTimerView | null;
}

export interface GameHistoryEntryView {
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
  readonly playerLimit: 3 | 4 | 5 | 6;
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

export type RoomSettingsInput = Omit<RoomSettingsView, "mapSeed">;

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
 * How many trailing event records a projection carries.
 *
 * The complete log stays on the server for replay; a view only needs what a
 * player can meaningfully scroll back through. Without a cap the entire history
 * rides along on every room update, and since each accepted command pushes the
 * whole room to every seat, a long match ends up sending hundreds of kilobytes
 * per move to every player.
 */
export const MAX_PROJECTED_EVENT_RECORDS = 200;

export function projectGameForPlayer(
  state: GameState,
  viewerId: string,
  eventRecords: readonly GameEventRecord[] = [],
  turnTimer: TurnTimerView | null = null,
  visibility: Pick<RoomSettingsView, "bankCountsPublic"> = { bankCountsPublic: true },
  victoryWarnings: readonly VictoryWarningEffectView[] = [],
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
    history: [...recentRecords.flatMap((record) => projectHistoryRecord(state, viewerId, record)), ...recentWarnings.map(victoryWarningHistory)].sort((a, b) => a.revision - b.revision),
    effects: [...recentRecords.flatMap((record) => projectPlayerSafeEffect(record, viewerId)), ...projectActionAttention(state, viewerId, interaction, eventRecords), ...(state.phase.kind === "turn" ? recentWarnings : [])],
    summary: projectGameSummary(state, eventRecords),
    turnTimer,
  };
}

function projectHistoryRecord(
  state: GameState,
  viewerId: string,
  record: GameEventRecord,
): readonly GameHistoryEntryView[] {
  const event = record.event;
  const playerName = (playerId: string) => state.players.find((player) => player.id === playerId)?.name ?? "玩家";
  if (event.type === "resources_produced") {
    if (event.grants.length === 0) {
      return [{ revision: record.revision, type: event.type, message: "本轮无资源", privateDetail: null }];
    }
    return [{
      revision: record.revision,
      type: event.type,
      message: event.grants.map((grant) => `${playerName(grant.playerId)} +${formatResources(grant.resources)}`).join("；"),
      privateDetail: null,
    }];
  }
  // The next public action already identifies the new turn. Keeping this
  // transport transition in the log adds a row without adding useful context.
  if (event.type === "turn_ended") return [];
  let message: string;
  let privateDetail: string | null = null;

  switch (event.type) {
    case "initial_settlement_placed": message = `${playerName(event.playerId)} 放置初始村庄`; break;
    case "initial_road_placed": message = `${playerName(event.playerId)} 放置初始道路`; break;
    case "starting_resources_granted": message = `${playerName(event.playerId)} 起始资源：${formatResources(event.resources)}`; break;
    case "setup_completed": message = "初始摆放完成"; break;
    case "dice_rolled": message = `${playerName(event.playerId)} 掷出 ${event.dice[0] + event.dice[1]}`; break;
    case "resources_discarded": message = `${playerName(event.playerId)} 弃掉 ${event.total} 张资源`; break;
    case "robber_moved":
      message = event.victimId === null
        ? `${playerName(event.playerId)} 移动强盗`
        : `${playerName(event.playerId)} 移动强盗，从${playerName(event.victimId)}处偷取 1 张`;
      if (event.stolenResource !== null && (event.playerId === viewerId || event.victimId === viewerId)) {
        privateDetail = event.playerId === viewerId
          ? `偷到：${resourceLabel(event.stolenResource)}`
          : `被偷：${resourceLabel(event.stolenResource)}`;
      }
      break;
    case "piece_built": message = `${playerName(event.playerId)} 建造 ${pieceLabel(event.piece)}`; break;
    case "trade_offered": message = `${playerName(event.playerId)} 发布报价`; break;
    case "trade_response_recorded":
      message = event.response === "accepted"
        ? `${playerName(event.playerId)} 接受报价`
        : event.response === "countered"
          ? `${playerName(event.playerId)} 提出反报价`
          : `${playerName(event.playerId)} 拒绝报价`;
      break;
    case "trade_cancelled": message = `${playerName(event.playerId)} 取消报价`; break;
    case "player_trade_completed": message = `${playerName(event.proposerId)} 与 ${playerName(event.accepterId)}：${formatResources(event.give)}换${formatResources(event.receive)}`; break;
    case "maritime_trade_completed": message = `${playerName(event.playerId)} 港口：${event.ratio}${resourceLabel(event.give)}换1${resourceLabel(event.receive)}`; break;
    case "development_card_bought":
      message = `${playerName(event.playerId)} 购买发展卡`;
      if (event.playerId === viewerId) privateDetail = `购入：${developmentLabel(event.cardType)}`;
      break;
    case "development_card_played":
      message = event.cardType === "monopoly"
        ? `${playerName(event.playerId)} 使用垄断（${resourceLabel(event.resource)}），获得 ${event.total} 张`
        : event.cardType === "resource-choice"
          ? `${playerName(event.playerId)} 使用丰收（${formatResources(event.resources)}）`
          : `${playerName(event.playerId)} 使用 ${developmentLabel(event.cardType)}`;
      if (event.cardType === "monopoly") {
        const ownLoss = event.transfers.find((transfer) => transfer.playerId === viewerId)?.amount ?? 0;
        if (ownLoss > 0) privateDetail = `你交出 ${ownLoss} 张${resourceLabel(event.resource)}`;
      }
      break;
    case "free_road_built": message = `${playerName(event.playerId)} 免费道路 ${event.placed}/${event.total}`; break;
    case "award_changed": message = event.holderId === null ? `${awardLabel(event.award)}：暂无` : `${playerName(event.holderId)} 获得 ${awardLabel(event.award)}`; break;
    case "game_won": message = `${playerName(event.playerId)} 获胜`; break;
  }

  return [{ revision: record.revision, type: event.type, message, privateDetail }];
}

function formatResources(resources: ResourceHand): string {
  const parts = RESOURCE_TYPES
    .filter((resource) => resources[resource] > 0)
    .map((resource) => `${resources[resource]}${resourceLabel(resource)}`);
  return parts.length === 0 ? "无资源" : parts.join("、");
}

function resourceLabel(resource: ResourceType): string {
  return { brick: "砖", lumber: "木", wool: "羊", grain: "麦", ore: "矿" }[resource];
}

function pieceLabel(piece: "road" | "settlement" | "city"): string {
  return { road: "道路", settlement: "村庄", city: "城市" }[piece];
}

function developmentLabel(card: string): string {
  return {
    knight: "骑士",
    "road-building": "道路建设",
    monopoly: "垄断",
    "resource-choice": "丰收",
    "victory-point": "胜利点",
  }[card] ?? card;
}

function awardLabel(award: "longest-road" | "largest-army"): string {
  return award === "longest-road" ? "最长道路" : "最大骑士力";
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
