import { RESOURCE_TYPES, type GameState, type GameEventRecord, type ResourceHand, type ResourceType } from "@catan/game-core";
import type { GameHistoryEntryView } from "./views.js";

export function projectHistoryRecord(
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
