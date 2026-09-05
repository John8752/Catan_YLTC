import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CATAN_GAME_ID } from "@catan/protocol";
import { AccountService, publicAccount } from "./account-service.js";
import { accountContext, sameOrigin, sessionCookie, readAccountCookie } from "./http.js";
import type { MatchRepository } from "../database/match-repository.js";
import { AuthError } from "./password.js";

const password = z.string().min(1);
const displayName = z.string().trim().min(1);
const login = z.object({ username: z.string().trim().regex(/^[a-zA-Z0-9_]+$/), password,
  guestSeat: z.object({ roomId: z.string().max(6), seatToken: z.string().max(100) }).optional() });
const register = login.extend({ displayName, password });

export function registerAuthRoutes(app: FastifyInstance, service: AccountService, matches: MatchRepository, lifetimeMs: number): void {
  const buckets = new Map<string, { count: number; expires: number }>();
  function limitUsername(username: string) {
    const now = Date.now();
    for (const [key, bucket] of buckets) if (bucket.expires <= now) buckets.delete(key);
    const key = username.toLowerCase();
    const bucket = buckets.get(key) ?? { count: 0, expires: now + 60_000 };
    if (bucket.count >= 10 || (!buckets.has(key) && buckets.size >= 10_000)) throw new AuthError("AUTH_BUSY", "登录尝试过多，请稍后重试", 429);
    bucket.count++; buckets.set(key, bucket);
  }
  for (const action of ["login", "register"] as const) {
    app.post(`/api/auth/${action}`, { config: { rateLimit: { max: action === "register" ? 5 : 20, timeWindow: "1 minute" } } }, async (request, reply) => {
      sameOrigin(request);
      const body = (action === "register" ? register : login).parse(request.body);
      limitUsername(body.username);
      const result = action === "register" ? await service.register(register.parse(body)) : await service.login(body);
      reply.header("set-cookie", sessionCookie(result.cookie, Math.floor(lifetimeMs / 1000)));
      return result.response;
    });
  }
  app.get("/api/auth/me", async (request, reply) => {
    const context = service.authenticate(readAccountCookie(request));
    if (!context) { reply.header("set-cookie", sessionCookie("", 0)); return null; }
    return service.view(context);
  });
  app.post("/api/auth/logout", async (request, reply) => {
    service.logout(accountContext(service, request, true));
    reply.header("set-cookie", sessionCookie("", 0));
    return { ok: true };
  });
  app.patch("/api/account/profile", async (request) => {
    const context = accountContext(service, request, true);
    const body = z.object({ displayName }).parse(request.body);
    service.repository.updateProfile(context.account.id, body.displayName, Date.now());
    return publicAccount(service.repository.findId(context.account.id)!);
  });
  app.post("/api/account/change-password", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const context = accountContext(service, request, true);
    const body = z.object({ currentPassword: password, newPassword: password }).parse(request.body);
    await service.changePassword(context, body.currentPassword, body.newPassword);
    reply.header("set-cookie", sessionCookie("", 0));
    return { ok: true };
  });
  app.get("/api/account/matches", async (request) => {
    const context = accountContext(service, request);
    const query = z.object({ gameId: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/).default(CATAN_GAME_ID),
      offset: z.coerce.number().int().min(0).max(100_000).default(0), limit: z.coerce.number().int().min(1).max(50).default(20) }).parse(request.query);
    return matches.history(context.account.id, query.gameId, query.offset, query.limit);
  });
}
