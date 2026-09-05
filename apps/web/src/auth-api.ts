import type { AccountView, AuthResponse, ChangePasswordRequest, LoginRequest, MatchHistoryResponse, RegisterRequest } from "@catan/protocol";
import { ApiError } from "./api.js";

// Memory only. The session itself is an HttpOnly cookie, managed by the server.
let csrfToken: string | null = null;
export function setAccountCsrf(value: string | null): void { csrfToken = value; }
export function accountHeaders(): Record<string, string> { return csrfToken ? { "x-csrf-token": csrfToken } : {}; }
export async function authRequest<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, { method, credentials: "same-origin", headers: { "content-type": "application/json", ...accountHeaders() },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok) throw new ApiError(result.error?.code ?? "UNKNOWN", result.error?.message ?? "请求失败");
  return result as T;
}
export const getAccount = () => authRequest<AuthResponse | null>("/api/auth/me");
export const loginAccount = (body: LoginRequest) => authRequest<AuthResponse>("/api/auth/login", "POST", body);
export const registerAccount = (body: RegisterRequest) => authRequest<AuthResponse>("/api/auth/register", "POST", body);
export const logoutAccount = () => authRequest("/api/auth/logout", "POST", {});
export const changeAccountPassword = (body: ChangePasswordRequest) => authRequest("/api/account/change-password", "POST", body);
export const updateAccountProfile = (displayName: string) => authRequest<AccountView>("/api/account/profile", "PATCH", { displayName });
export const getMatchHistory = (gameId: string, offset = 0) => authRequest<MatchHistoryResponse>(`/api/account/matches?${new URLSearchParams({ gameId, offset: String(offset) })}`);
