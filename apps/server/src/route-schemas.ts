import { z } from "zod";
import { PLAYER_COLORS } from "@catan/game-core";
import { AI_COMMENTARY_MODES } from "@catan/protocol";
export const playerNameSchema = z.object({
  playerName: z.string(),
});

export const startRoomSchema = z.object({
  seatToken: z.string().min(1),
});

export const roomSettingsSchema = z.object({
  seatToken: z.string().min(1),
  expectedRevision: z.number().int().positive(),
  ruleProfile: z.enum(["base-3-4", "extended-5-6"]),
  victoryPointsToWin: z.number().int().min(5).max(15),
  bankCountsPublic: z.boolean().optional(),
});

export const rerollRoomMapSchema = z.object({
  seatToken: z.string().min(1),
  expectedRevision: z.number().int().positive(),
});

export const playerColorSchema = z.object({
  seatToken: z.string().min(1),
  expectedRevision: z.number().int().positive(),
  color: z.enum(PLAYER_COLORS),
});

export const shuffleRoomMembersSchema = z.object({
  seatToken: z.string().min(1),
  expectedRevision: z.number().int().positive(),
});

export const leaveRoomSchema = z.object({
  seatToken: z.string().min(1),
});

export const gameCommandSchema = z.object({
  seatToken: z.string().min(1),
  commandId: z.string().min(1).max(100),
  expectedRevision: z.number().int().positive(),
  command: z.discriminatedUnion("type", [
    z.object({ type: z.literal("PlaceInitialSettlement"), vertexId: z.string().min(1) }),
    z.object({ type: z.literal("PlaceInitialRoad"), edgeId: z.string().min(1) }),
    z.object({ type: z.literal("RollDice") }),
    z.object({
      type: z.literal("DiscardResources"),
      resources: z.object({
        brick: z.number().int().nonnegative(),
        lumber: z.number().int().nonnegative(),
        wool: z.number().int().nonnegative(),
        grain: z.number().int().nonnegative(),
        ore: z.number().int().nonnegative(),
      }),
    }),
    z.object({
      type: z.literal("MoveRobber"),
      hexId: z.string().min(1),
      victimId: z.string().min(1).nullable(),
    }),
    z.object({ type: z.literal("BuildRoad"), edgeId: z.string().min(1) }),
    z.object({ type: z.literal("BuildSettlement"), vertexId: z.string().min(1) }),
    z.object({ type: z.literal("BuildCity"), vertexId: z.string().min(1) }),
    z.object({
      type: z.literal("OpenTradeOffer"),
      offerId: z.string().min(1),
      give: z.object({ brick: z.number().int().nonnegative(), lumber: z.number().int().nonnegative(), wool: z.number().int().nonnegative(), grain: z.number().int().nonnegative(), ore: z.number().int().nonnegative() }),
      receive: z.object({ brick: z.number().int().nonnegative(), lumber: z.number().int().nonnegative(), wool: z.number().int().nonnegative(), grain: z.number().int().nonnegative(), ore: z.number().int().nonnegative() }),
    }),
    z.object({ type: z.literal("AcceptTradeOffer"), offerId: z.string().min(1) }),
    z.object({ type: z.literal("DeclineTradeOffer"), offerId: z.string().min(1) }),
    z.object({
      type: z.literal("CounterTradeOffer"),
      offerId: z.string().min(1),
      proposerGives: z.object({ brick: z.number().int().nonnegative(), lumber: z.number().int().nonnegative(), wool: z.number().int().nonnegative(), grain: z.number().int().nonnegative(), ore: z.number().int().nonnegative() }),
      proposerReceives: z.object({ brick: z.number().int().nonnegative(), lumber: z.number().int().nonnegative(), wool: z.number().int().nonnegative(), grain: z.number().int().nonnegative(), ore: z.number().int().nonnegative() }),
    }),
    z.object({
      type: z.literal("CompleteTradeOffer"),
      offerId: z.string().min(1),
      partnerId: z.string().min(1),
    }),
    z.object({ type: z.literal("CancelTradeOffer"), offerId: z.string().min(1) }),
    z.object({
      type: z.literal("MaritimeTrade"),
      give: z.enum(["brick", "lumber", "wool", "grain", "ore"]),
      receive: z.enum(["brick", "lumber", "wool", "grain", "ore"]),
    }),
    z.object({ type: z.literal("BuyDevelopmentCard") }),
    z.object({ type: z.literal("PlayKnight"), cardId: z.string().min(1) }),
    z.object({ type: z.literal("PlayRoadBuilding"), cardId: z.string().min(1) }),
    z.object({ type: z.literal("BuildFreeRoad"), edgeId: z.string().min(1) }),
    z.object({ type: z.literal("PlayMonopoly"), cardId: z.string().min(1), resource: z.enum(["brick", "lumber", "wool", "grain", "ore"]) }),
    z.object({
      type: z.literal("PlayResourceChoice"),
      cardId: z.string().min(1),
      resources: z.tuple([
        z.enum(["brick", "lumber", "wool", "grain", "ore"]),
        z.enum(["brick", "lumber", "wool", "grain", "ore"]),
      ]),
    }),
    z.object({ type: z.literal("EndTurn") }),
  ]),
});

export const aiCommentarySchema = z.object({
  seatToken: z.string().min(1),
  expectedRevision: z.number().int().positive(),
  mode: z.enum(AI_COMMENTARY_MODES),
});
