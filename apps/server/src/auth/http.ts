import type { FastifyRequest } from "fastify";
import type { AccountService, AuthContext } from "./account-service.js";
import { safeEqual } from "./account-service.js";
import { AuthError } from "./password.js";

export const ACCOUNT_COOKIE = "catan_account_session";
export function readAccountCookie(request: FastifyRequest): string | undefined {
  return request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${ACCOUNT_COOKIE}=`))?.slice(ACCOUNT_COOKIE.length + 1);
}
export function sessionCookie(value: string, maxAge: number): string {
  return `${ACCOUNT_COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}
export function sameOrigin(request: FastifyRequest): void {
  const origin = request.headers.origin;
  const expected = `${request.protocol}://${request.host}`;
  if (origin !== expected || request.headers["sec-fetch-site"] === "cross-site") {
    throw new AuthError("CSRF_REJECTED", "请求来源无效，请刷新页面后重试", 403);
  }
}
export function accountContext(service: AccountService, request: FastifyRequest, mutation = false): AuthContext {
  const context = service.authenticate(readAccountCookie(request));
  if (!context) throw new AuthError("AUTH_REQUIRED", "登录已失效，请重新登录");
  if (mutation) {
    sameOrigin(request);
    const token = request.headers["x-csrf-token"];
    if (typeof token !== "string" || !safeEqual(token, context.csrfToken)) throw new AuthError("CSRF_REJECTED", "页面已失效，请刷新后重试", 403);
  }
  return context;
}
