import http from "k6/http";
import { check } from "k6";
import { BASE_URL, PASSWORD } from "./config.js";

const SESSION_TTL_MS = 5 * 60 * 1000;
const cachedSessions = new Map();

function readTokenCookie(response) {
  const tokenCookies = response.cookies && response.cookies.token;
  if (!Array.isArray(tokenCookies) || tokenCookies.length === 0) {
    return null;
  }
  return tokenCookies[0].value || null;
}

export function getSessionForUser(user) {
  const key = user.email;
  const now = Date.now();
  const cached = cachedSessions.get(key);

  if (cached && cached.expiresAt > now) {
    return cached;
  }

  const loginResponse = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: user.email, password: PASSWORD }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { flow: "session", endpoint: "auth_login" },
    },
  );

  const token = readTokenCookie(loginResponse);
  const loginOk = check(loginResponse, {
    "session login status is 200": (res) => res.status === 200,
    "session login returns token cookie": () => Boolean(token),
  });

  if (!loginOk || !token) {
    return null;
  }

  const session = {
    email: user.email,
    headers: {
      Cookie: `token=${token}`,
      "Content-Type": "application/json",
    },
    expiresAt: now + SESSION_TTL_MS,
  };

  cachedSessions.set(key, session);
  return session;
}

export function clearSession(user) {
  cachedSessions.delete(user.email);
}

