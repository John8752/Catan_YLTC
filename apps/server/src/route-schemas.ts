import { z } from "zod";
import { PLAYER_COLORS } from "@catan/game-core/primitives";
import { GAME_IDS } from "@catan/protocol/platform";
export const playerNameSchema = z.object({
  playerName: z.string(),
});
export const createRoomSchema = playerNameSchema.extend({ gameId: z.enum(GAME_IDS).default("catan") });
export const returnToLobbySchema = z.object({ seatToken: z.string().min(1), matchId: z.string().min(1) }).strict();

export const startRoomSchema = z.object({
  seatToken: z.string().min(1),
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
