import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import Fastify, {
  LogController,
  type FastifyError,
  type FastifyReply,
  type FastifyServerOptions,
} from "fastify";
import { z } from "zod";
import { RoomError } from "./room-errors.js";
import { RoomRegistry } from "./rooms.js";

/** A room with no connected socket is collected once it goes untouched this long. */
export const DEFAULT_IDLE_ROOM_TTL_MS = 60 * 60 * 1000;
export const DEFAULT_ROOM_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
/** Room creation is the only unbounded allocation a stranger can trigger. */
export const DEFAULT_ROOM_CREATIONS_PER_MINUTE = 10;

export interface AppOptions {
  readonly logger?: FastifyServerOptions["logger"];
  readonly trustProxy?: FastifyServerOptions["trustProxy"];
  readonly idleRoomTtlMs?: number;
  readonly roomSweepIntervalMs?: number;
  readonly roomCreationsPerMinute?: number;
}

const playerNameSchema = z.object({
  playerName: z.string(),
});

const startRoomSchema = z.object({
  seatToken: z.string().min(1),
});

const roomSettingsSchema = z.object({
  seatToken: z.string().min(1),
  expectedRevision: z.number().int().positive(),
  ruleProfile: z.enum(["base-3-4", "extended-5-6"]),
  playerLimit: z.union([z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  victoryPointsToWin: z.number().int().min(5).max(15),
});

const rerollRoomMapSchema = z.object({
  seatToken: z.string().min(1),
  expectedRevision: z.number().int().positive(),
});

const leaveRoomSchema = z.object({
  seatToken: z.string().min(1),
});

const gameCommandSchema = z.object({
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

export async function buildApp(registry = new RoomRegistry(), options: AppOptions = {}) {
  const idleRoomTtlMs = options.idleRoomTtlMs ?? DEFAULT_IDLE_ROOM_TTL_MS;
  const roomSweepIntervalMs = options.roomSweepIntervalMs ?? DEFAULT_ROOM_SWEEP_INTERVAL_MS;
  const app = Fastify({
    logger: options.logger ?? false,
    // Behind a reverse proxy every request arrives from the proxy's address, so
    // without this the per-IP rate limit below becomes one bucket for the whole
    // site and a single busy player locks everyone else out.
    trustProxy: options.trustProxy ?? false,
    // Successful traffic stays out of the journal; the hook below records failures.
    logController: new LogController({ disableRequestLogging: true }),
  });

  // Routes answer their own errors, so Fastify never sees them. Log the route
  // pattern rather than request.url: seat tokens travel in the query string.
  app.addHook("onResponse", async (request, reply) => {
    if (reply.statusCode < 400) return;
    const line = {
      method: request.method,
      route: request.routeOptions.url ?? request.url,
      status: reply.statusCode,
    };
    if (reply.statusCode >= 500) request.log.error(line, "request failed");
    else request.log.warn(line, "request rejected");
  });

  await app.register(websocket);
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () =>
      Object.assign(new Error("Too many rooms created; wait a moment"), { statusCode: 429 }),
  });

  // Anything thrown outside a route handler (rate limiter, malformed body, bugs)
  // still has to reach the client in the shape apps/web parses.
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } });
    }
    const code = statusCode === 429 ? "TOO_MANY_REQUESTS" : "INVALID_REQUEST";
    return reply.code(statusCode).send({ error: { code, message: error.message } });
  });

  const sweep = setInterval(() => {
    const evicted = registry.evictIdleRooms(idleRoomTtlMs);
    if (evicted.length > 0) {
      app.log.info({ evicted: evicted.length, rooms: registry.roomCount }, "evicted idle rooms");
    }
  }, roomSweepIntervalMs);
  sweep.unref();
  app.addHook("onClose", async () => {
    clearInterval(sweep);
    registry.dispose();
  });

  app.get("/health", async () => ({ ok: true, service: "catan-server", rooms: registry.roomCount }));

  app.post("/api/rooms", {
    config: {
      rateLimit: {
        max: options.roomCreationsPerMinute ?? DEFAULT_ROOM_CREATIONS_PER_MINUTE,
        timeWindow: "1 minute",
      },
    },
  }, async (request, reply) => {
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
      return reply.code(200).send(registry.startRoom(request.params.roomId, body.seatToken));
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.patch<{ Params: { roomId: string } }>("/api/rooms/:roomId/settings", async (request, reply) => {
    try {
      const body = roomSettingsSchema.parse(request.body);
      return reply.code(200).send(
        registry.updateSettings(request.params.roomId, body.seatToken, body.expectedRevision, {
          ruleProfile: body.ruleProfile,
          playerLimit: body.playerLimit,
          victoryPointsToWin: body.victoryPointsToWin,
        }),
      );
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post<{ Params: { roomId: string } }>("/api/rooms/:roomId/reroll-map", async (request, reply) => {
    try {
      const body = rerollRoomMapSchema.parse(request.body);
      return reply.code(200).send(
        registry.rerollMap(request.params.roomId, body.seatToken, body.expectedRevision),
      );
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post<{ Params: { roomId: string } }>("/api/rooms/:roomId/leave", async (request, reply) => {
    try {
      const body = leaveRoomSchema.parse(request.body);
      return reply.code(200).send(registry.leaveRoom(request.params.roomId, body.seatToken));
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get<{ Params: { roomId: string }; Querystring: { seatToken?: string } }>(
    "/api/rooms/:roomId",
    async (request, reply) => {
      try {
        const seatToken = z.string().min(1).parse(request.query.seatToken);
        return reply.code(200).send(registry.getRoom(request.params.roomId, seatToken));
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
          body.seatToken,
          body.commandId,
          body.expectedRevision,
          body.command,
        ),
      );
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get<{ Querystring: { roomId?: string; seatToken?: string } }>(
    "/ws",
    { websocket: true },
    (socket, request) => {
      try {
        const roomId = z.string().min(1).parse(request.query.roomId);
        const seatToken = z.string().min(1).parse(request.query.seatToken);
        const unsubscribe = registry.subscribe(roomId, seatToken, (room) => {
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
