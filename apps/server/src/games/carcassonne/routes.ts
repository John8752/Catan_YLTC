import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { RoomRegistry } from "../../rooms.js";
import { sendError } from "../../route-errors.js";

const commandSchema = z.object({ seatToken: z.string().min(1).max(256), commandId: z.string().min(1).max(128), command: z.object({
  type: z.literal("place"), matchId: z.string().min(1).max(128), turn: z.number().int().min(1).max(71),
  x: z.number().int().min(-72).max(72), y: z.number().int().min(-72).max(72), rotation: z.number().int().min(0).max(3),
  meeple: z.string().min(1).max(16).nullable(),
}).strict() }).strict();
export function registerCarcassonneRoutes(app: FastifyInstance, registry: RoomRegistry) {
  app.post<{ Params: { roomId: string } }>("/api/rooms/:roomId/carcassonne/commands", { bodyLimit: 4096 }, async (request, reply) => {
    try { const body = commandSchema.parse(request.body); return reply.send(registry.executeCarcassonneCommand(request.params.roomId, body.seatToken, body.commandId, body.command)); }
    catch (error) { return sendError(reply, error); }
  });
}
