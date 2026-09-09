import type { FastifyInstance } from "fastify";
import type { RoomRegistry } from "../../rooms.js";
import { drawCommandSchema, drawSettingsSchema } from "./schemas.js";
import { sendError } from "../../route-errors.js";

export function registerDrawGuessRoutes(app: FastifyInstance, registry: RoomRegistry) {
  app.patch<{ Params: { roomId: string } }>("/api/rooms/:roomId/draw-guess/settings", async (request, reply) => {
    try { const body = drawSettingsSchema.parse(request.body); return reply.send(registry.updateDrawSettings(request.params.roomId, body.seatToken, body.expectedRevision, { textSeconds: body.textSeconds, drawingSeconds: body.drawingSeconds })); }
    catch (error) { return sendError(reply, error); }
  });
  app.post<{ Params: { roomId: string } }>("/api/rooms/:roomId/draw-guess/commands", {
    bodyLimit: 128 * 1024, config: { rateLimit: { max: 600, timeWindow: "1 minute", groupId: "draw-guess" } },
  }, async (request, reply) => {
    try { const body = drawCommandSchema.parse(request.body); return reply.send(registry.executeDrawCommand(request.params.roomId, body.seatToken, body.commandId, body.command)); }
    catch (error) { return sendError(reply, error); }
  });

}
