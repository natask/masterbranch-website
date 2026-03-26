import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";

let _auth: NeonAuth | null = null;

export function getAuth(): NeonAuth {
  if (!_auth) {
    if (!process.env.NEON_AUTH_BASE_URL || !process.env.NEON_AUTH_COOKIE_SECRET) {
      throw new Error("Neon Auth not configured: set NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET");
    }
    _auth = createNeonAuth({
      baseUrl: process.env.NEON_AUTH_BASE_URL,
      cookies: {
        secret: process.env.NEON_AUTH_COOKIE_SECRET,
      },
    });
  }
  return _auth;
}

// Lazy proxy that only initializes when actually called at runtime
export const auth = new Proxy({} as NeonAuth, {
  get(_, prop) {
    return (getAuth() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
