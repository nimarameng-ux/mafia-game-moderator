const crypto = require("node:crypto");

const COOKIE_NAME = "mafia_weekly_access";
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map();

function configuration() {
  const accessCode = String(process.env.MAFIA_WEEKLY_ACCESS_CODE || "").trim();
  const cookieSecret = String(process.env.MAFIA_ACCESS_COOKIE_SECRET || "").trim();
  if (accessCode.length < 10 || cookieSecret.length < 32) return null;
  return { accessCode, cookieSecret };
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function signingKey(config) {
  return crypto
    .createHash("sha256")
    .update(config.cookieSecret)
    .update("\0")
    .update(config.accessCode)
    .digest();
}

function sign(payload, config) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", signingKey(config))
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

function verify(token, config) {
  if (!token || !token.includes(".")) return null;
  const [encoded, provided] = token.split(".", 2);
  const expected = crypto
    .createHmac("sha256", signingKey(config))
    .update(encoded)
    .digest("base64url");
  if (!safeEqual(provided, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!Number.isFinite(payload.exp) || payload.exp <= Date.now()) return null;
    return payload;
  } catch (_error) {
    return null;
  }
}

function cookieValue(req) {
  const cookies = String(req.headers.cookie || "").split(";");
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0) continue;
    if (cookie.slice(0, separator).trim() === COOKIE_NAME) {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    }
  }
  return "";
}

function ipAddress(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function isRateLimited(req) {
  const key = ipAddress(req);
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((time) => now - time < ATTEMPT_WINDOW_MS);
  attempts.set(key, recent);
  return recent.length >= MAX_ATTEMPTS;
}

function recordFailure(req) {
  const key = ipAddress(req);
  const recent = attempts.get(key) || [];
  recent.push(Date.now());
  attempts.set(key, recent);
}

function clearFailures(req) {
  attempts.delete(ipAddress(req));
}

function respond(res, status, body) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(status).json(body);
}

module.exports = function handler(req, res) {
  const config = configuration();
  if (!config) {
    return respond(res, 503, { message: "Weekly access is not configured." });
  }

  if (req.method === "GET") {
    const payload = verify(cookieValue(req), config);
    if (!payload) return respond(res, 401, { authorized: false });
    return respond(res, 200, {
      authorized: true,
      expiresAt: new Date(payload.exp).toISOString(),
    });
  }

  if (req.method === "POST") {
    if (isRateLimited(req)) {
      return respond(res, 429, { message: "Too many attempts. Try again later." });
    }
    const provided = String(req.body?.accessCode || "").trim();
    if (!safeEqual(provided, config.accessCode)) {
      recordFailure(req);
      return respond(res, 401, { message: "That access code is not correct." });
    }
    clearFailures(req);
    const expires = Date.now() + SESSION_SECONDS * 1000;
    const token = sign({ iat: Date.now(), exp: expires }, config);
    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`,
    );
    return respond(res, 200, {
      authorized: true,
      expiresAt: new Date(expires).toISOString(),
    });
  }

  if (req.method === "DELETE") {
    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    );
    return respond(res, 200, { authorized: false });
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return respond(res, 405, { message: "Method not allowed." });
};

module.exports._test = { configuration, sign, verify, safeEqual, COOKIE_NAME };
