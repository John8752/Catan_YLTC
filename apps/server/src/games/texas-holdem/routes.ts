import type { FastifyInstance } from "fastify";
import type { RoomRegistry } from "../../rooms.js";
import { sendError } from "../../route-errors.js";
import { pokerCommandSchema, pokerSettingsSchema } from "./schemas.js";
export function registerPokerRoutes(app: FastifyInstance, registry: RoomRegistry) {
  app.post<{ Params: { roomId: string } }>("/api/rooms/:roomId/texas-holdem/commands", { bodyLimit: 4096, config: { rateLimit: { max: 240, timeWindow: "1 minute", groupId: "texas-holdem" } } }, async (req, reply) => {
    try { const b = pokerCommandSchema.parse(req.body); return reply.send(registry.executePokerCommand(req.params.roomId, b.seatToken, b.commandId, b.command)); }
    catch (e) { return sendError(reply, e); }
  });
  app.patch<{ Params: { roomId: string } }>("/api/rooms/:roomId/texas-holdem/settings", async (req, reply) => {
    try { const { seatToken, expectedRevision, ...settings } = pokerSettingsSchema.parse(req.body); return reply.send(registry.updatePokerSettings(req.params.roomId, seatToken, expectedRevision, settings)); }
    catch (e) { return sendError(reply, e); }
  });
}
