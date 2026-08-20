import {
  BUILD_COSTS,
  hasResources,
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
  readonly developmentCardCount: number;
  readonly playedKnights: number;
}

export interface PrivatePlayerView extends PublicPlayerView {
  readonly resources: ResourceHand;
  readonly maritimeRatios: Readonly<Record<ResourceType, 2 | 3 | 4>>;
  readonly developmentCards: readonly DevelopmentCardState[];
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
  readonly lastRoll: readonly [number, number] | null;
  readonly you: PrivatePlayerView;
  readonly interaction: GameInteractionView;
  readonly openTrade: TradeOfferState | null;
  readonly developmentDeckCount: number;
  readonly developmentCardPlayedThisTurn: boolean;
  readonly awards: AwardsState;
  readonly history: readonly GameHistoryEntryView[];
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

export interface RoomView {
  readonly id: string;
  readonly revision: number;
  readonly hostPlayerId: string;
  readonly members: readonly LobbyMemberView[];
  readonly game: GameView | null;
}

export function projectGameForPlayer(
  state: GameState,
  viewerId: string,
  eventRecords: readonly GameEventRecord[] = [],
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
    lastRoll: state.lastRoll,
    you: {
      ...publicViewer,
      resources: { ...viewer.resources },
      maritimeRatios: Object.fromEntries(
        RESOURCE_TYPES.map((resource) => [resource, maritimeRatio(state, viewerId, resource)]),
      ) as Record<ResourceType, 2 | 3 | 4>,
      developmentCards: viewer.developmentCards.map((card) => ({ ...card })),
    },
    interaction: projectInteraction(state, viewerId),
    openTrade: state.openTrade,
    developmentDeckCount: state.developmentDeck.length,
    developmentCardPlayedThisTurn: state.developmentCardPlayedThisTurn,
    awards: state.awards,
    history: eventRecords.flatMap((record) => projectHistoryRecord(state, viewerId, record)),
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
      return [{ revision: record.revision, type: event.type, message: "本轮没有人获得资源", privateDetail: null }];
    }
    return event.grants.map((grant) => ({
      revision: record.revision,
      type: event.type,
      message: `${playerName(grant.playerId)} 获得 ${formatResources(grant.resources)}`,
      privateDetail: null,
    }));
  }
  let message: string;
  let privateDetail: string | null = null;

  switch (event.type) {
    case "initial_settlement_placed": message = `${playerName(event.playerId)} 放置了初始定居点`; break;
    case "initial_road_placed": message = `${playerName(event.playerId)} 放置了初始道路`; break;
    case "starting_resources_granted": message = `${playerName(event.playerId)} 获得起始资源：${formatResources(event.resources)}`; break;
    case "setup_completed": message = "初始摆放完成"; break;
    case "dice_rolled": message = `${playerName(event.playerId)} 掷出 ${event.dice[0] + event.dice[1]}`; break;
    case "resources_discarded": message = `${playerName(event.playerId)} 弃掉 ${event.total} 张资源`; break;
    case "robber_moved":
      message = `${playerName(event.playerId)} 移动了强盗${event.victimId === null ? "" : `并偷取了 ${playerName(event.victimId)}`}`;
      if (event.stolenResource !== null && (event.playerId === viewerId || event.victimId === viewerId)) {
        privateDetail = `偷取资源：${event.stolenResource}`;
      }
      break;
    case "turn_ended": message = `${playerName(event.playerId)} 结束回合`; break;
    case "piece_built": message = `${playerName(event.playerId)} 建造了 ${pieceLabel(event.piece)}`; break;
    case "trade_offered": message = `${playerName(event.playerId)} 发布交易报价`; break;
    case "trade_response_recorded": message = `${playerName(event.playerId)} ${event.response === "accepted" ? "同意" : "拒绝"}了交易报价`; break;
    case "trade_cancelled": message = `${playerName(event.playerId)} 取消交易报价`; break;
    case "player_trade_completed": message = `${playerName(event.proposerId)} 给 ${playerName(event.accepterId)} ${formatResources(event.give)}，获得 ${formatResources(event.receive)}`; break;
    case "maritime_trade_completed": message = `${playerName(event.playerId)} 用 ${event.ratio} ${resourceLabel(event.give)}换得 1 ${resourceLabel(event.receive)}`; break;
    case "development_card_bought":
      message = `${playerName(event.playerId)} 购买了一张发展卡`;
      if (event.playerId === viewerId) privateDetail = `购入：${event.cardType}`;
      break;
    case "development_card_played": message = `${playerName(event.playerId)} 使用了 ${developmentLabel(event.cardType)}`; break;
    case "free_road_built": message = `${playerName(event.playerId)} 放置了一条免费道路`; break;
    case "award_changed": message = event.holderId === null ? `${awardLabel(event.award)} 暂时无人持有` : `${playerName(event.holderId)} 获得 ${awardLabel(event.award)}`; break;
    case "game_won": message = `${playerName(event.playerId)} 赢得对局`; break;
  }

  return [{ revision: record.revision, type: event.type, message, privateDetail }];
}

function formatResources(resources: ResourceHand): string {
  const parts = RESOURCE_TYPES
    .filter((resource) => resources[resource] > 0)
    .map((resource) => `${resources[resource]} ${resourceLabel(resource)}`);
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
      return {
        kind: "waiting",
        instruction: `等待 ${actor?.name ?? "当前玩家"} 行动`,
        vertexIds: [],
        edgeIds: [],
      };
    }
    if (state.phase.step === "roll") {
      return { kind: "turn-roll", instruction: "轮到你了，请掷骰子", vertexIds: [], edgeIds: [] };
    }
    if (state.phase.step === "action") {
      const player = state.players.find((candidate) => candidate.id === viewerId);
      if (player === undefined) throw new Error(`Player ${viewerId} is missing`);
      return {
        kind: "turn-action",
        instruction: "你可以交易、建造或结束回合",
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
