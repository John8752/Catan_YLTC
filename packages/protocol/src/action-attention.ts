import type { GameEventRecord, GameState } from "@catan/game-core";
import type { GameInteractionView } from "./views.js";

export interface ActionPrompt {
  readonly tone: "required" | "trade";
  readonly title: string;
  readonly notice: string;
}

export interface ActionAttentionEffectView extends ActionPrompt {
  readonly kind: "action-attention";
  readonly id: string;
  readonly revision: number;
}

/** Copy follows the authoritative interaction, never client-side legality. */
export function describeAction(interaction: GameInteractionView): ActionPrompt | null {
  switch (interaction.kind) {
    case "waiting": return null;
    case "setup-settlement": return { tone: "required", title: "初始摆放 · 请放置定居点", notice: "轮到你摆放了" };
    case "setup-road": return { tone: "required", title: "初始摆放 · 请放置道路", notice: "轮到你摆放了" };
    case "turn-roll": return { tone: "required", title: "轮到你了 · 请掷骰子", notice: "轮到你了" };
    case "turn-action": return interaction.pairedPlayer
      ? { tone: "required", title: "搭档行动 · 可交易、建造", notice: "轮到你进行搭档行动" }
      : { tone: "required", title: "轮到你了 · 可交易、建造", notice: "轮到你了" };
    case "discard": return { tone: "required", title: `需要你弃牌 · 请选择 ${interaction.requiredCount} 张`, notice: `请弃掉 ${interaction.requiredCount} 张资源` };
    case "robber": return { tone: "required", title: "需要你操作 · 请移动强盗", notice: "请移动强盗" };
    case "free-road": return { tone: "required", title: "需要你操作 · 请放置免费道路", notice: "请放置免费道路" };
    case "trade-response": return { tone: "trade", title: "收到交易报价 · 可前往回应", notice: "收到一份交易报价" };
  }
}

/** A current-request effect, not a historical reward. Its id spans snapshots of
 * one opportunity (including roll -> action and settlement -> road), so clients
 * can notify once without reconstructing turns or comparing private hands. */
export function projectActionAttention(
  state: GameState,
  viewerId: string,
  interaction: GameInteractionView,
  records: readonly GameEventRecord[],
): readonly ActionAttentionEffectView[] {
  const prompt = describeAction(interaction);
  if (prompt === null || state.phase.kind === "finished") return [];
  let opportunity: string;
  if (state.phase.kind === "setup") {
    opportunity = `setup:${state.phase.placementIndex}`;
  } else if (interaction.kind === "trade-response") {
    opportunity = `trade:${interaction.offerId}`;
  } else {
    const turn = `turn:${state.phase.turnNumber}:${state.phase.activePlayerId}`;
    if (interaction.kind === "discard") opportunity = `${turn}:discard`;
    else if (interaction.kind === "robber" || interaction.kind === "free-road") {
      const trigger = records.findLast((record) => record.event.type === "development_card_played"
        && record.event.playerId === viewerId
        && record.event.cardType === (interaction.kind === "robber" ? "knight" : "road-building"));
      opportunity = `${turn}:${interaction.kind}:${trigger?.revision ?? 0}`;
    } else opportunity = turn;
  }
  return [{ ...prompt, kind: "action-attention", id: `attention:${viewerId}:${opportunity}`, revision: state.revision }];
}
