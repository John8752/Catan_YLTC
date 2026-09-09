import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { RoomRegistry } from "../../rooms.js";
import type { AiCommentator } from "./ai-commentary.js";
import { AiCommentaryUpstreamError } from "./ai-commentary.js";
import { buildTableIntentInput } from "./ai-intent.js";
import { roomSettingsSchema, rerollRoomMapSchema, gameCommandSchema, aiCommentarySchema } from "./schemas.js";
import { sendError, sendApiError } from "../../route-errors.js";

export const DEFAULT_AI_REQUESTS_PER_MINUTE = 6;
export function registerCatanRoutes(app: FastifyInstance, registry: RoomRegistry,
  options: { readonly aiRequestsPerMinute?: number; readonly aiCommentator?: AiCommentator | null }) {
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
          body.matchId,
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
      const room = registry.getCatanRoom(request.params.roomId, body.seatToken);
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
        registry.recordTableIntentUse(request.params.roomId, body.seatToken, room.game.id, room.game.phase.turnNumber);
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

}
