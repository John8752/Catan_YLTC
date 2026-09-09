// Memory only. The session itself is an HttpOnly cookie, managed by the server.
let csrfToken: string | null = null;
export function setAccountCsrf(value: string | null): void { csrfToken = value; }
export function accountHeaders(): Record<string, string> { return csrfToken ? { "x-csrf-token": csrfToken } : {}; }
