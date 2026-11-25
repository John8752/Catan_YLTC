import { z } from "zod";
import type { PokerCommandRequest, PokerSettingsRequest } from "@catan/protocol/texas-holdem";
const integer = z.number().int().safe();
const action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("fold") }).strict(), z.object({ type: z.literal("check") }).strict(), z.object({ type: z.literal("call") }).strict(),
  z.object({ type: z.literal("all-in") }).strict(), z.object({ type: z.literal("raise"), to: integer.positive() }).strict(), z.object({ type: z.literal("next-hand") }).strict(),
]);
export const pokerCommandSchema: z.ZodType<PokerCommandRequest> = z.object({ seatToken: z.string().min(1).max(256), commandId: z.string().min(1).max(128), command: z.object({ matchId: z.string().min(1).max(128), handNumber: integer.positive(), expectedRevision: integer.positive(), action }).strict() }).strict();
export const pokerSettingsSchema: z.ZodType<PokerSettingsRequest> = z.object({ seatToken: z.string().min(1), expectedRevision: integer.positive(), mode: z.enum(["fixed-hands", "tournament"]), startingChips: integer.min(100).max(100000), smallBlind: integer.min(1).max(1000), handLimit: integer.min(1).max(100), blindInterval: integer.min(1).max(50), actionSeconds: z.union([z.literal(15), z.literal(30), z.literal(60)]) }).strict();
