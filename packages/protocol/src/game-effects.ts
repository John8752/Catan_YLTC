import {
  BUILD_COSTS,
  resourceAmounts,
  type GameEventRecord,
  type ResourceGrantSource,
  type ResourceHand,
  type ResourceType,
} from "@catan/game-core";

export type PublicGameEffectView =
  | PublicResourceGrantEffectView
  | PrivateResourceTransferEffectView
  | PublicResourceSpendEffectView
  | PublicScoreChangeEffectView
  | PublicRobberMoveEffectView;

export interface PublicResourceGrantEffectView {
  readonly id: string;
  readonly revision: number;
  readonly kind: "resource-grant";
  readonly reason: "production" | "starting-resources" | "player-trade" | "maritime-trade";
  readonly grants: readonly {
    readonly playerId: string;
    readonly resources: ResourceHand;
    readonly origin?: { readonly kind: "player"; readonly playerId: string } | { readonly kind: "bank" };
  }[];
  readonly sources: readonly ResourceGrantSource[];
  readonly triggeredHexIds: readonly string[];
}

export interface PrivateResourceTransferEffectView {
  readonly id: string;
  readonly revision: number;
  readonly kind: "resource-transfer";
  readonly reason: "robber";
  readonly transfers: readonly {
    readonly playerId: string;
    readonly sourcePlayerId: string;
    readonly amount: number;
    readonly resource: ResourceType | null;
  }[];
}

export interface PublicResourceSpendEffectView {
  readonly id: string;
  readonly revision: number;
  readonly kind: "resource-spend";
  readonly playerId: string;
  readonly resources: ResourceHand;
  readonly destination:
    | { readonly kind: "build"; readonly piece: "road" | "settlement" | "city"; readonly locationId: string }
    | { readonly kind: "development" };
}

export interface PublicScoreChangeEffectView {
  readonly id: string;
  readonly revision: number;
  readonly kind: "score-change";
  readonly playerId: string;
  readonly delta: 1 | 2;
  readonly reason: "settlement" | "city" | "longest-road" | "largest-army" | "victory-point";
}

export interface PublicRobberMoveEffectView {
  readonly id: string;
  readonly revision: number;
  readonly kind: "robber-move";
  readonly playerId: string;
  readonly fromHexId: string;
  readonly toHexId: string;
}

export function projectPlayerSafeEffect(
  record: GameEventRecord,
  viewerId: string,
): readonly PublicGameEffectView[] {
  const event = record.event;
  if (event.type === "resources_produced") {
    if (event.triggeredHexIds.length === 0) return [];
    return [{
      id: `${record.revision}:resources-produced`,
      revision: record.revision,
      kind: "resource-grant",
      reason: "production",
      grants: event.grants,
      sources: event.sources,
      triggeredHexIds: event.triggeredHexIds,
    }];
  }
  if (event.type === "starting_resources_granted" && event.total > 0) {
    return [{
      id: `${record.revision}:starting-resources:${event.playerId}`,
      revision: record.revision,
      kind: "resource-grant",
      reason: "starting-resources",
      grants: [{ playerId: event.playerId, resources: event.resources }],
      sources: event.sources,
      triggeredHexIds: [...new Set(event.sources.map((source) => source.hexId))],
    }];
  }
  if (event.type === "player_trade_completed") {
    return [{
      id: `${record.revision}:player-trade:${event.offerId}`,
      revision: record.revision,
      kind: "resource-grant",
      reason: "player-trade",
      grants: [
        { playerId: event.proposerId, resources: event.receive, origin: { kind: "player", playerId: event.accepterId } },
        { playerId: event.accepterId, resources: event.give, origin: { kind: "player", playerId: event.proposerId } },
      ],
      sources: [],
      triggeredHexIds: [],
    }];
  }
  if (event.type === "maritime_trade_completed") {
    return [{
      id: `${record.revision}:maritime-trade:${event.playerId}`,
      revision: record.revision,
      kind: "resource-grant",
      reason: "maritime-trade",
      grants: [{
        playerId: event.playerId,
        resources: resourceAmounts({ [event.receive]: 1 }),
        origin: { kind: "bank" },
      }],
      sources: [],
      triggeredHexIds: [],
    }];
  }
  if (event.type === "robber_moved") {
    const effects: PublicGameEffectView[] = [{
      id: `${record.revision}:robber-move:${event.playerId}`,
      revision: record.revision,
      kind: "robber-move",
      playerId: event.playerId,
      fromHexId: event.fromHexId,
      toHexId: event.hexId,
    }];
    if (event.victimId === null || event.stolenResource === null) return effects;
    const canSeeResource = event.playerId === viewerId || event.victimId === viewerId;
    effects.push({
      id: `${record.revision}:robber-transfer:${event.playerId}`,
      revision: record.revision,
      kind: "resource-transfer",
      reason: "robber",
      transfers: [{
        playerId: event.playerId,
        sourcePlayerId: event.victimId,
        amount: 1,
        resource: canSeeResource ? event.stolenResource : null,
      }],
    });
    return effects;
  }
  if (event.type === "piece_built") {
    const effects: PublicGameEffectView[] = [{
      id: `${record.revision}:resource-spend:${event.playerId}:${event.piece}`,
      revision: record.revision,
      kind: "resource-spend",
      playerId: event.playerId,
      resources: BUILD_COSTS[event.piece],
      destination: { kind: "build", piece: event.piece, locationId: event.locationId },
    }];
    if (event.piece !== "road") {
      effects.push({
        id: `${record.revision}:score:${event.playerId}:${event.piece}`,
        revision: record.revision,
        kind: "score-change",
        playerId: event.playerId,
        delta: 1,
        reason: event.piece,
      });
    }
    return effects;
  }
  if (event.type === "development_card_bought") {
    const effects: PublicGameEffectView[] = [{
      id: `${record.revision}:resource-spend:${event.playerId}:development`,
      revision: record.revision,
      kind: "resource-spend",
      playerId: event.playerId,
      resources: BUILD_COSTS.development,
      destination: { kind: "development" },
    }];
    if (event.playerId === viewerId && event.cardType === "victory-point") {
      effects.push({
        id: `${record.revision}:score:${event.playerId}:victory-point`,
        revision: record.revision,
        kind: "score-change",
        playerId: event.playerId,
        delta: 1,
        reason: "victory-point",
      });
    }
    return effects;
  }
  if (event.type === "award_changed" && event.holderId !== null) {
    return [{
      id: `${record.revision}:score:${event.holderId}:${event.award}`,
      revision: record.revision,
      kind: "score-change",
      playerId: event.holderId,
      delta: 2,
      reason: event.award,
    }];
  }
  return [];
}
