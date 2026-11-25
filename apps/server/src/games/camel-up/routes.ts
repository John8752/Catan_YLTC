import { z } from "zod";
import { RACING_CAMELS } from "@catan/game-core/camel-up";
import type { FastifyInstance } from "fastify";
import type { RoomRegistry } from "../../rooms.js";
import { sendError } from "../../route-errors.js";
const base = { matchId: z.string().min(1).max(100), expectedRevision: z.number().int().nonnegative().safe() };
export const camelCommandSchema = z.object({ seatToken: z.string().min(1).max(200), commandId: z.string().min(1).max(100), command: z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("roll") }).strict(),
  z.object({ ...base, type: z.literal("ticket"), camel: z.enum(RACING_CAMELS) }).strict(),
  z.object({ ...base, type: z.literal("tile"), space: z.number().int().min(2).max(16), side: z.enum(["cheer", "boo"]) }).strict(),
  z.object({ ...base, type: z.literal("finish-bet"), camel: z.enum(RACING_CAMELS), kind: z.enum(["winner", "loser"]) }).strict(),
  z.object({ ...base, type: z.literal("partner"), playerId: z.string().min(1).max(100) }).strict(),
]) }).strict();
export function registerCamelRoutes(app: FastifyInstance, registry: RoomRegistry) {
  app.post<{ Params: { roomId: string } }>("/api/rooms/:roomId/camel-up/commands", {
    bodyLimit: 4096, config: { rateLimit: { max: 120, timeWindow: "1 minute", groupId: "camel-up" } },
  }, async (request, reply) => {
    try { const body = camelCommandSchema.parse(request.body); return reply.send(registry.executeCamelCommand(request.params.roomId, body.seatToken, body.commandId, body.command)); }
    catch (error) { return sendError(reply, error); }
  });
}
