/**
 * Access token lives only in memory (module-level variable).
 * This protects against XSS — no localStorage exposure.
 * The refresh token travels as an HttpOnly cookie (managed by browser).
 */

let _accessToken: string | null = null;

export const tokenStore = {
  get: (): string | null => _accessToken,
  set: (token: string): void => { _accessToken = token; },
  clear: (): void => { _accessToken = null; },
};
