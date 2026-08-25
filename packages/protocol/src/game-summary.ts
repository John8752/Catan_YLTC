import {
  BUILD_COSTS,
  RESOURCE_TYPES,
  resourceAmounts,
  resourceCardCount,
  type GameEventRecord,
  type GameState,
  type ResourceHand,
} from "@catan/game-core";

export interface GameSummaryView {
  readonly totalRolls: number;
  readonly diceTotals: readonly { readonly total: number; readonly count: number }[];
  readonly players: readonly PlayerGameSummaryView[];
}

export interface PlayerGameSummaryView {
  readonly playerId: string;
  readonly visibleVictoryPoints: number;
  readonly score: {
    readonly settlements: number;
    readonly cities: number;
    readonly longestRoad: boolean;
    readonly largestArmy: boolean;
  };
  readonly resourceCards: {
    readonly starting: number;
    readonly produced: number;
    readonly tradeReceived: number;
    readonly maritimeReceived: number;
    readonly stolen: number;
    readonly robbed: number;
    readonly spent: number;
    readonly tradedAway: number;
    readonly discarded: number;
    readonly finalHand: number;
  };
  readonly productionByResource: ResourceHand;
  readonly activity: {
    readonly rolls: number;
    readonly roadsBuilt: number;
    readonly settlementsBuilt: number;
    readonly citiesBuilt: number;
    readonly developmentCardsBought: number;
    readonly developmentCardsPlayed: number;
    readonly playerTrades: number;
    readonly maritimeTrades: number;
    readonly robberMoves: number;
  };
}

interface MutablePlayerSummary {
  resourceCards: {
    -readonly [Key in keyof Omit<PlayerGameSummaryView["resourceCards"], "finalHand">]: number;
  };
  productionByResource: ResourceHand;
  activity: PlayerGameSummaryView["activity"];
}

export function projectGameSummary(
  state: GameState,
  records: readonly GameEventRecord[],
): GameSummaryView | null {
  if (state.phase.kind !== "finished") return null;

  const diceTotals = new Map(Array.from({ length: 11 }, (_, index) => [index + 2, 0]));
  const mutable = new Map(state.players.map((player) => [player.id, emptyPlayerSummary()]));

  for (const record of records) {
    const event = record.event;
    switch (event.type) {
      case "starting_resources_granted": {
        const summary = requireSummary(mutable, event.playerId);
        summary.resourceCards.starting += event.total;
        break;
      }
      case "dice_rolled": {
        const total = event.dice[0] + event.dice[1];
        diceTotals.set(total, (diceTotals.get(total) ?? 0) + 1);
        incrementActivity(mutable, event.playerId, "rolls");
        break;
      }
      case "resources_produced":
        for (const grant of event.grants) {
          const summary = requireSummary(mutable, grant.playerId);
          summary.resourceCards.produced += resourceCardCount(grant.resources);
          addResources(summary.productionByResource, grant.resources);
        }
        break;
      case "resources_discarded":
        requireSummary(mutable, event.playerId).resourceCards.discarded += event.total;
        break;
      case "robber_moved":
        incrementActivity(mutable, event.playerId, "robberMoves");
        if (event.victimId !== null && event.stolenResource !== null) {
          requireSummary(mutable, event.playerId).resourceCards.stolen += 1;
          requireSummary(mutable, event.victimId).resourceCards.robbed += 1;
        }
        break;
      case "initial_road_placed":
      case "free_road_built":
        incrementActivity(mutable, event.playerId, "roadsBuilt");
        break;
      case "initial_settlement_placed":
        incrementActivity(mutable, event.playerId, "settlementsBuilt");
        break;
      case "piece_built": {
        const summary = requireSummary(mutable, event.playerId);
        summary.resourceCards.spent += resourceCardCount(BUILD_COSTS[event.piece]);
        incrementActivity(mutable, event.playerId, event.piece === "road" ? "roadsBuilt" : event.piece === "settlement" ? "settlementsBuilt" : "citiesBuilt");
        break;
      }
      case "player_trade_completed": {
        const proposer = requireSummary(mutable, event.proposerId);
        const accepter = requireSummary(mutable, event.accepterId);
        proposer.resourceCards.tradeReceived += resourceCardCount(event.receive);
        proposer.resourceCards.tradedAway += resourceCardCount(event.give);
        accepter.resourceCards.tradeReceived += resourceCardCount(event.give);
        accepter.resourceCards.tradedAway += resourceCardCount(event.receive);
        incrementActivity(mutable, event.proposerId, "playerTrades");
        incrementActivity(mutable, event.accepterId, "playerTrades");
        break;
      }
      case "maritime_trade_completed": {
        const summary = requireSummary(mutable, event.playerId);
        summary.resourceCards.maritimeReceived += 1;
        summary.resourceCards.tradedAway += event.ratio;
        incrementActivity(mutable, event.playerId, "maritimeTrades");
        break;
      }
      case "development_card_bought": {
        const summary = requireSummary(mutable, event.playerId);
        summary.resourceCards.spent += resourceCardCount(BUILD_COSTS.development);
        incrementActivity(mutable, event.playerId, "developmentCardsBought");
        break;
      }
      case "development_card_played":
        incrementActivity(mutable, event.playerId, "developmentCardsPlayed");
        break;
      default:
        break;
    }
  }

  return {
    totalRolls: [...diceTotals.values()].reduce((sum, count) => sum + count, 0),
    diceTotals: [...diceTotals].map(([total, count]) => ({ total, count })),
    players: state.players.map((player): PlayerGameSummaryView => {
      const summary = requireSummary(mutable, player.id);
      const buildings = state.buildings.filter((building) => building.ownerId === player.id);
      return {
        playerId: player.id,
        visibleVictoryPoints: player.visibleVictoryPoints,
        score: {
          settlements: buildings.filter((building) => building.kind === "settlement").length,
          cities: buildings.filter((building) => building.kind === "city").length,
          longestRoad: state.awards.longestRoad.holderId === player.id,
          largestArmy: state.awards.largestArmy.holderId === player.id,
        },
        resourceCards: { ...summary.resourceCards, finalHand: resourceCardCount(player.resources) },
        productionByResource: { ...summary.productionByResource },
        activity: { ...summary.activity },
      };
    }),
  };
}

function emptyPlayerSummary(): MutablePlayerSummary {
  return {
    resourceCards: {
      starting: 0,
      produced: 0,
      tradeReceived: 0,
      maritimeReceived: 0,
      stolen: 0,
      robbed: 0,
      spent: 0,
      tradedAway: 0,
      discarded: 0,
    },
    productionByResource: resourceAmounts({}),
    activity: {
      rolls: 0,
      roadsBuilt: 0,
      settlementsBuilt: 0,
      citiesBuilt: 0,
      developmentCardsBought: 0,
      developmentCardsPlayed: 0,
      playerTrades: 0,
      maritimeTrades: 0,
      robberMoves: 0,
    },
  };
}

function requireSummary(map: Map<string, MutablePlayerSummary>, playerId: string): MutablePlayerSummary {
  const summary = map.get(playerId);
  if (summary === undefined) throw new Error(`Missing game summary player ${playerId}`);
  return summary;
}

function incrementActivity(
  map: Map<string, MutablePlayerSummary>,
  playerId: string,
  key: keyof PlayerGameSummaryView["activity"],
): void {
  const summary = requireSummary(map, playerId);
  summary.activity = { ...summary.activity, [key]: summary.activity[key] + 1 };
}

function addResources(target: ResourceHand, addition: ResourceHand): void {
  for (const resource of RESOURCE_TYPES) target[resource] += addition[resource];
}
