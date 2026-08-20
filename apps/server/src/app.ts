import websocket from "@fastify/websocket";
import Fastify, { type FastifyReply } from "fastify";
import { z } from "zod";
import { RoomError, RoomRegistry } from "./rooms.js";

const playerNameSchema = z.object({
  playerName: z.string(),
});

const startRoomSchema = z.object({
  playerId: z.string().min(1),
});

const gameCommandSchema = z.object({
  playerId: z.string().min(1),
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

export async function buildApp(registry = new RoomRegistry()) {
  const app = Fastify({ logger: false });
  await app.register(websocket);

  app.get("/health", async () => ({ ok: true, service: "catan-server" }));

  app.post("/api/rooms", async (request, reply) => {
    try {
      const body = playerNameSchema.parse(request.body);
      return reply.code(201).send(registry.createRoom(body.playerName));
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post<{ Params: { roomId: string } }>("/api/rooms/:roomId/join", async (request, reply) => {
    try {
      const body = playerNameSchema.parse(request.body);
      return reply.code(200).send(registry.joinRoom(request.params.roomId, body.playerName));
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post<{ Params: { roomId: string } }>("/api/rooms/:roomId/start", async (request, reply) => {
    try {
      const body = startRoomSchema.parse(request.body);
      return reply.code(200).send(registry.startRoom(request.params.roomId, body.playerId));
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get<{ Params: { roomId: string }; Querystring: { playerId?: string } }>(
    "/api/rooms/:roomId",
    async (request, reply) => {
      try {
        const playerId = z.string().min(1).parse(request.query.playerId);
        return reply.code(200).send(registry.getRoom(request.params.roomId, playerId));
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.post<{ Params: { roomId: string } }>("/api/rooms/:roomId/commands", async (request, reply) => {
    try {
      const body = gameCommandSchema.parse(request.body);
      return reply.code(200).send(
        registry.executeCommand(
          request.params.roomId,
          body.playerId,
          body.commandId,
          body.expectedRevision,
          body.command,
        ),
      );
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get<{ Querystring: { roomId?: string; playerId?: string } }>(
    "/ws",
    { websocket: true },
    (socket, request) => {
      try {
        const roomId = z.string().min(1).parse(request.query.roomId);
        const playerId = z.string().min(1).parse(request.query.playerId);
        const unsubscribe = registry.subscribe(roomId, playerId, (room) => {
          socket.send(JSON.stringify({ type: "room_state", room }));
        });

        socket.on("close", unsubscribe);
      } catch (error) {
        const normalized = normalizeError(error);
        socket.send(JSON.stringify({ type: "error", ...normalized }));
        socket.close();
      }
    },
  );

  return app;
}

function sendError(reply: FastifyReply, error: unknown) {
  const normalized = normalizeError(error);
  const statusCode =
    normalized.code === "ROOM_NOT_FOUND"
      ? 404
      : normalized.code === "INTERNAL_ERROR"
        ? 500
        : 400;

  return reply.code(statusCode).send({ error: normalized });
}

function normalizeError(error: unknown): { code: string; message: string } {
  if (error instanceof RoomError) {
    return { code: error.code, message: error.message };
  }

  if (error instanceof z.ZodError) {
    return { code: "INVALID_REQUEST", message: "Request data is invalid" };
  }

  return { code: "INTERNAL_ERROR", message: "Unexpected server error" };
}
