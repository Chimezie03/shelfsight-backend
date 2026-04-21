import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";
import { BASE_URL, AUTH_USERS, pickByVu } from "../lib/config.js";
import { clearSession, getSessionForUser } from "../lib/session.js";
import { handleSummaryFactory } from "../lib/summary.js";

const smokeFlowDuration = new Trend("smoke_flow_duration", true);

export const options = {
  vus: 1,
  iterations: 5,
  thresholds: {
    http_req_failed: ["rate<0.05"],
    checks: ["rate>0.98"],
    smoke_flow_duration: ["p(95)<2000"],
  },
};

export default function smokeSuite() {
  const startedAt = Date.now();
  const user = pickByVu(AUTH_USERS);
  const session = getSessionForUser(user);

  check(session, {
    "smoke session established": (value) => value !== null,
  });
  if (!session) {
    sleep(1);
    return;
  }

  const meResponse = http.get(`${BASE_URL}/auth/me`, {
    headers: session.headers,
    tags: { scenario: "smoke", endpoint: "auth_me" },
  });
  check(meResponse, {
    "smoke auth/me status is 200": (res) => res.status === 200,
  });

  const booksResponse = http.get(`${BASE_URL}/books?limit=5&page=1&search=the`, {
    headers: session.headers,
    tags: { scenario: "smoke", endpoint: "books_list" },
  });
  check(booksResponse, {
    "smoke books status is 200": (res) => res.status === 200,
  });

  const loansResponse = http.get(`${BASE_URL}/loans?limit=5&page=1`, {
    headers: session.headers,
    tags: { scenario: "smoke", endpoint: "loans_list" },
  });
  check(loansResponse, {
    "smoke loans status is 200": (res) => res.status === 200,
  });

  const logoutResponse = http.post(`${BASE_URL}/auth/logout`, null, {
    headers: session.headers,
    tags: { scenario: "smoke", endpoint: "auth_logout" },
  });
  check(logoutResponse, {
    "smoke auth/logout status is 200": (res) => res.status === 200,
  });

  clearSession(user);
  smokeFlowDuration.add(Date.now() - startedAt);
  sleep(0.5);
}

export const handleSummary = handleSummaryFactory("smoke");

