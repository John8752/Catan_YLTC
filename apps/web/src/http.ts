import type { ApiErrorResponse } from "@catan/protocol/platform";
import { accountHeaders } from "./auth-headers.js";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "same-origin", headers: { ...init?.headers, ...accountHeaders() } });

  if (!response.ok) {
    const payload = (await response.json()) as ApiErrorResponse;
    throw new ApiError(payload.error.code, payload.error.message);
  }

  return (await response.json()) as T;
}
