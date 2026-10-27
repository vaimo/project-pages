import crypto from "crypto";

/**
 * Sandboxed guide iframes (no `allow-same-origin`) have an opaque origin, so
 * the browser treats their subresource requests as cross-site and won't
 * attach the session cookie — /api/raw would 401 for every asset the guide
 * tries to load. These short-lived signed tokens let the server pre-approve
 * the exact (branch, path) pairs it already rewrote into the guide's HTML,
 * so the sandboxed iframe can fetch them without needing cookies at all.
 */

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes — long enough to view a guide, short enough to limit exposure if a URL leaks

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not configured");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signRawAssetToken(path: string, branch: string): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const sig = sign(`${branch}:${path}:${exp}`);
  return `${exp}.${sig}`;
}

export function verifyRawAssetToken(token: string, path: string, branch: string): boolean {
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!exp || !sig || Date.now() > exp) return false;

  const expected = sign(`${branch}:${path}:${exp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
