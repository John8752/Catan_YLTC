import { createRoomEventEncoder, ROOM_EVENT_TRANSPORT, createRoomStreamEncoder, ROOM_MAP_TRANSPORT } from "@catan/protocol";
import { playerNameSchema, startRoomSchema, roomSettingsSchema, rerollRoomMapSchema, playerColorSchema, shuffleRoomMembersSchema, leaveRoomSchema, gameCommandSchema, aiCommentarySchema } from "./route-schemas.js";
import { SqliteDatabase } from "./database/sqlite-database.js";
import { SqliteAccountRepository } from "./database/sqlite-account-repository.js";
import { SqliteMatchRepository } from "./database/match-repository.js";
import { AccountService } from "./auth/account-service.js";
import { AuthError } from "./auth/password.js";
import { registerAuthRoutes } from "./auth/routes.js";
import { accountContext, readAccountCookie, sameOrigin } from "./auth/http.js";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import Fastify, {
  LogController,
  type FastifyError,
  type FastifyReply,
  type FastifyServerOptions,
} from "fastify";
import { z } from "zod";
import { AiCommentaryUpstreamError, type AiCommentator } from "./ai-commentary.js";
import { buildTableIntentInput } from "./ai-intent.js";
import { RoomError } from "./room-errors.js";
import { RoomRegistry } from "./rooms.js";

/** A room with no connected socket is collected once it goes untouched this long. */
export const DEFAULT_IDLE_ROOM_TTL_MS = 60 * 60 * 1000;
export const DEFAULT_ROOM_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
/** Room creation is the only unbounded allocation a stranger can trigger. */
export const DEFAULT_ROOM_CREATIONS_PER_MINUTE = 10;
export const DEFAULT_AI_REQUESTS_PER_MINUTE = 6;

export interface AppOptions {
  readonly database?: SqliteDatabase;
  readonly sessionLifetimeMs?: number;
  readonly logger?: FastifyServerOptions["logger"];
  readonly trustProxy?: FastifyServerOptions["trustProxy"];
  readonly idleRoomTtlMs?: number;
  readonly roomSweepIntervalMs?: number;
  readonly roomCreationsPerMinute?: number;
  readonly aiRequestsPerMinute?: number;
  readonly aiCommentator?: AiCommentator | null;
}

export async function buildApp(registry: RoomRegistry | undefined = undefined, options: AppOptions = {}) {
  registry ??= new RoomRegistry();
  const database = options.database ?? new SqliteDatabase(":memory:");
  const sessionLifetimeMs = options.sessionLifetimeMs ?? 30 * 86400_000;
  const accounts = new AccountService(new SqliteAccountRepository(database), registry, sessionLifetimeMs);
  const matches = new SqliteMatchRepository(database);
  registry.configureMatchRepository(matches, () => app.log.error({ code: "SETTLEMENT_WRITE_FAILED" }, "Final settlement could not be saved; timer will retry"));
  registry.configureAccountValidation((id) => accounts.repository.hasLiveSession(id, Date.now()));
  if (options.aiCommentator !== undefined) registry.configureAiCommentator(options.aiCommentator);
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

  app.addHook("onRequest", async (request, reply) => {
    if (request.url.startsWith("/api/")) reply.header("cache-control", "no-store");
    if (request.url.startsWith("/ws") && request.headers.origin) sameOrigin(request);
  });

  // Routes answer their own errors, so Fastify never sees them. Log the route
  // pattern rather than request.url: seat tokens travel in the query string.
  //
  // The room id and the error code ride along because without them a rejection is
  // undiagnosable: a burst of 400s on this route reads the same whether players
  // are racing each other into STALE_REVISION or clicking moves the rules refuse,
  // and those want opposite fixes. Both values are safe to keep -- the room id is
  // the code printed on screen for players to share, and the error code is one of
  // a fixed set of constants.
  app.addHook("onResponse", async (request, reply) => {
    if (reply.statusCode < 400) return;
    const params = request.params as { readonly roomId?: string } | undefined;
    const line = {
      method: request.method,
      route: request.routeOptions.url ?? request.url,
      status: reply.statusCode,
      roomId: params?.roomId,
      code: rejectionCodes.get(reply),
    };
    if (reply.statusCode >= 500) request.log.error(line, "request failed");
    else request.log.warn(line, "request rejected");
  });

  // Every accepted command pushes the whole room to every seat, and by the late
  // game that projection is ~75 KB: the immutable map, plus the trailing event
  // records rendered twice (`history` and `effects`). Caddy's `encode gzip` only
  // covers HTTP responses -- WebSocket frames pass through it untouched -- so
  // without this the push went out uncompressed to phones on a 300 ms link.
  // The same payload deflates to ~6.6 KB, so the compression is worth the per
  // connection zlib context (a table of players is a handful of sockets).
  await app.register(websocket, {
    options: {
      perMessageDeflate: {
        // Below a kilobyte the frames are lobby chatter that deflate cannot
        // meaningfully shrink; paying for a zlib pass there is pure overhead.
        threshold: 1024,
        zlibDeflateOptions: { level: 6 },
      },
    },
  });
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () =>
      Object.assign(new Error("Too many rooms created; wait a moment"), { statusCode: 429 }),
  });

  // Anything thrown outside a route handler (rate limiter, malformed body, bugs)
  // still has to reach the client in the shape apps/web parses.
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error instanceof AuthError) return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
    if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: "请检查输入内容" } });
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      rejectionCodes.set(reply, "INTERNAL_ERROR");
      return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } });
    }
    const code = statusCode === 429 ? "TOO_MANY_REQUESTS" : "INVALID_REQUEST";
    rejectionCodes.set(reply, code);
    return reply.code(statusCode).send({ error: { code, message: error.message } });
  });

  const sweep = setInterval(() => {
    const evicted = registry.evictIdleRooms(idleRoomTtlMs);
    if (evicted.length > 0) {
      app.log.info({ evicted: evicted.length, rooms: registry.roomCount }, "evicted idle rooms");
    }
  }, roomSweepIntervalMs);
  sweep.unref();
  const sessionSweep = setInterval(() => accounts.expireSessions(), 30_000);
  sessionSweep.unref();
  app.addHook("onClose", async () => {
    clearInterval(sweep);
    clearInterval(sessionSweep);
    registry.dispose();
    if (!options.database) database.close();
  });

  registerAuthRoutes(app, accounts, matches, sessionLifetimeMs);

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
      return reply.code(201).send(registry.createRoom(
        readAccountCookie(request) ? accountContext(accounts, request, true).account.displayName : body.playerName,
        readAccountCookie(request) ? accountContext(accounts, request, true).account.id : null));
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post<{ Params: { roomId: string } }>("/api/rooms/:roomId/join", async (request, reply) => {
    try {
      const body = playerNameSchema.parse(request.body);
      return reply.code(200).send(registry.joinRoom(request.params.roomId,
        readAccountCookie(request) ? accountContext(accounts, request, true).account.displayName : body.playerName,
        readAccountCookie(request) ? accountContext(accounts, request, true).account.id : null));
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
          victoryPointsToWin: body.victoryPointsToWin,
          bankCountsPublic: body.bankCountsPublic,
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

  app.patch<{ Params: { roomId: string } }>("/api/rooms/:roomId/player-color", async (request, reply) => {
    try {
      const body = playerColorSchema.parse(request.body);
      return reply.code(200).send(
        registry.updatePlayerColor(
          request.params.roomId,
          body.seatToken,
          body.expectedRevision,
          body.color,
        ),
      );
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post<{ Params: { roomId: string } }>("/api/rooms/:roomId/shuffle-members", async (request, reply) => {
    try {
      const body = shuffleRoomMembersSchema.parse(request.body);
      return reply.code(200).send(
        registry.shuffleMembers(request.params.roomId, body.seatToken, body.expectedRevision),
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

  app.post<{ Params: { roomId: string } }>("/api/rooms/:roomId/disband", async (request, reply) => {
    try {
      const body = leaveRoomSchema.parse(request.body);
      registry.disbandRoom(request.params.roomId, body.seatToken);
      return reply.code(200).send({ roomDeleted: true });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get<{ Params: { roomId: string }; Querystring: { seatToken?: string; transport?: string; afterRevision?: string } }>(
    "/api/rooms/:roomId",
    async (request, reply) => {
      try {
        const seatToken = z.string().min(1).parse(request.query.seatToken);
        const after = z.coerce.number().int().nonnegative().safe().optional().parse(request.query.afterRevision);
        return reply.code(200).send(registry.getRoom(request.params.roomId, seatToken, request.query.transport === ROOM_EVENT_TRANSPORT ? after ?? null : undefined));
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.get<{ Params: { roomId: string }; Querystring: { seatToken?: string; gameId?: string; beforeRevision?: string } }>(
    "/api/rooms/:roomId/history", async (request, reply) => {
      try {
        const seatToken = z.string().min(1).parse(request.query.seatToken);
        const gameId = z.string().min(1).parse(request.query.gameId);
        const before = z.coerce.number().int().positive().safe().optional().parse(request.query.beforeRevision);
        return reply.send(registry.getHistory(request.params.roomId, seatToken, gameId, before));
      } catch (error) { return sendError(reply, error); }
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
          body.responseMode,
        ),
      );
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post<{ Params: { roomId: string } }>("/api/rooms/:roomId/ai-commentary", {
    config: {
      rateLimit: {
        max: options.aiRequestsPerMinute ?? DEFAULT_AI_REQUESTS_PER_MINUTE,
        timeWindow: "1 minute",
        groupId: "ai-commentary",
        errorResponseBuilder: () =>
          Object.assign(new Error("AI 解说请求太频繁，请稍后再试"), { statusCode: 429 }),
      },
    },
  }, async (request, reply) => {
    try {
      const body = aiCommentarySchema.parse(request.body);
      const room = registry.getRoom(request.params.roomId, body.seatToken);
      if (room.game === null) {
        return sendApiError(reply, 400, "AI_GAME_NOT_STARTED", "开局后才能请 AI 解说");
      }
      if (room.game.revision !== body.expectedRevision) {
        return sendApiError(reply, 409, "STALE_REVISION", "游戏状态已更新，请重新分析");
      }
      if (options.aiCommentator === null || options.aiCommentator === undefined) {
        return sendApiError(reply, 503, "AI_NOT_CONFIGURED", "AI 解说暂未配置");
      }

      const mode = body.mode;
      if (mode === "intent") {
        if (room.game.phase.kind !== "turn") {
          return sendApiError(reply, 400, "AI_INTENT_NOT_IN_TURN", "摆放阶段还读不出谁想去哪");
        }
        if (!registry.tableIntentAvailable(request.params.roomId, body.seatToken)) {
          return sendApiError(reply, 429, "AI_INTENT_TURN_SPENT", "这回合的意图侦察已经用过了，下个回合再看");
        }
        // Built from public topology only and answered to this seat alone: the
        // read never enters room state, so no one else learns what was asked.
        const intent = await options.aiCommentator.analyzeIntent(buildTableIntentInput(room));
        registry.recordTableIntentUse(request.params.roomId, body.seatToken);
        return reply.code(200).send({ mode, revision: room.game.revision, content: intent.overview, intent });
      }

      const content = await options.aiCommentator.analyze(room, mode);
      return reply.code(200).send({ mode, revision: room.game.revision, content });
    } catch (error) {
      if (error instanceof AiCommentaryUpstreamError) {
        return sendApiError(reply, 502, "AI_UPSTREAM_ERROR", error.message);
      }
      return sendError(reply, error);
    }
  });

  app.get<{ Querystring: { roomId?: string; seatToken?: string; transport?: string } }>(
    "/ws",
    { websocket: true },
    (socket, request) => {
      try {
        const roomId = z.string().min(1).parse(request.query.roomId);
        const seatToken = z.string().min(1).parse(request.query.seatToken);
        const incremental = request.query.transport === ROOM_EVENT_TRANSPORT;
        const encode = incremental ? createRoomEventEncoder() : request.query.transport === ROOM_MAP_TRANSPORT ? createRoomStreamEncoder() : null;
        const unsubscribe = registry.subscribe(
          roomId,
          seatToken,
          (room) => {
            socket.send(JSON.stringify(encode ? encode(room) : { type: "room_state", room }));
          },
          () => {
            // Say why before closing, or the client just sees a dropped socket and
            // starts reconnecting to a room that no longer exists.
            socket.send(JSON.stringify({ type: "room_closed", message: "房主已解散房间" }));
            socket.close();
          },
          () => {
            socket.send(JSON.stringify({ type: "account_session_replaced", message: "账号登录已变更或退出，请重新登录" }));
            socket.close(4001);
          },
          incremental,
        );

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

/**
 * Why each failed reply was refused, for the response log to pick up.
 *
 * A WeakMap rather than a field on the reply: the entry disappears with the
 * request it belongs to, so a long-running process cannot accumulate them.
 */
const rejectionCodes = new WeakMap<FastifyReply, string>();

function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof AuthError) return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
  const normalized = normalizeError(error);
  const statusCode =
    normalized.code === "ROOM_NOT_FOUND"
      ? 404
      : normalized.code === "INTERNAL_ERROR"
        ? 500
        : 400;

  rejectionCodes.set(reply, normalized.code);
  return reply.code(statusCode).send({ error: normalized });
}

function sendApiError(reply: FastifyReply, statusCode: number, code: string, message: string) {
  rejectionCodes.set(reply, code);
  return reply.code(statusCode).send({ error: { code, message } });
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
