import type { FastifyReply } from "fastify";
import { z } from "zod";
import { AuthError } from "./auth/password.js";
import { RoomError } from "./room-errors.js";

/**
 * Why each failed reply was refused, for the response log to pick up.
 *
 * A WeakMap rather than a field on the reply: the entry disappears with the
 * request it belongs to, so a long-running process cannot accumulate them.
 */
export const rejectionCodes = new WeakMap<FastifyReply, string>();

export function sendError(reply: FastifyReply, error: unknown) {
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

export function sendApiError(reply: FastifyReply, statusCode: number, code: string, message: string) {
  rejectionCodes.set(reply, code);
  return reply.code(statusCode).send({ error: { code, message } });
}

export function normalizeError(error: unknown): { code: string; message: string } {
  if (error instanceof RoomError) {
    return { code: error.code, message: error.message };
  }

  if (error instanceof z.ZodError) {
    return { code: "INVALID_REQUEST", message: "Request data is invalid" };
  }

  return { code: "INTERNAL_ERROR", message: "Unexpected server error" };
}
