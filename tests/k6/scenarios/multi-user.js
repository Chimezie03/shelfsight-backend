import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";
import {
  AUTH_USERS,
  STAFF_USERS,
  PATRON_USERS,
  SEARCH_TERMS,
  AUTHORS,
  CATEGORIES,
  SEEDED_ISBNS,
  BASE_URL,
  PROFILE,
  pickByVu,
  randomItem,
} from "../lib/config.js";
import { getSessionForUser } from "../lib/session.js";
import { handleSummaryFactory } from "../lib/summary.js";

const coverImage = open("../fixtures/cover.png", "b");

const authFlowDuration = new Trend("auth_flow_duration", true);
const catalogFlowDuration = new Trend("catalog_flow_duration", true);
const circulationFlowDuration = new Trend("circulation_flow_duration", true);
const ingestionFlowDuration = new Trend("ingestion_flow_duration", true);
const checkoutConflicts = new Counter("checkout_conflicts");
const emptyCopyPools = new Counter("empty_copy_pools");
const okOrConflict = http.expectedStatuses(200, 409);
const createdOrConflict = http.expectedStatuses(201, 409);

const profiles = {
  quick: {
    auth: [
      { duration: "15s", target: 2 },
      { duration: "20s", target: 4 },
      { duration: "10s", target: 0 },
    ],
    catalog: [
      { duration: "15s", target: 4 },
      { duration: "20s", target: 8 },
      { duration: "10s", target: 0 },
    ],
    circulation: [
      { duration: "15s", target: 2 },
      { duration: "20s", target: 4 },
      { duration: "10s", target: 0 },
    ],
    ingestion: [
      { duration: "15s", target: 1 },
      { duration: "20s", target: 2 },
      { duration: "10s", target: 0 },
    ],
  },
  task3: {
    auth: [
      { duration: "30s", target: 4 },
      { duration: "1m", target: 10 },
      { duration: "30s", target: 0 },
    ],
    catalog: [
      { duration: "30s", target: 8 },
      { duration: "1m", target: 20 },
      { duration: "30s", target: 0 },
    ],
    circulation: [
      { duration: "30s", target: 4 },
      { duration: "1m", target: 10 },
      { duration: "30s", target: 0 },
    ],
    ingestion: [
      { duration: "30s", target: 2 },
      { duration: "1m", target: 5 },
      { duration: "30s", target: 0 },
    ],
  },
};

const selectedProfile = profiles[PROFILE] || profiles.task3;

export const options = {
  discardResponseBodies: false,
  scenarios: {
    auth_flow: {
      executor: "ramping-vus",
      startVUs: 0,
      gracefulRampDown: "10s",
      gracefulStop: "20s",
      stages: selectedProfile.auth,
      exec: "authFlow",
    },
    catalog_flow: {
      executor: "ramping-vus",
      startVUs: 0,
      gracefulRampDown: "10s",
      gracefulStop: "20s",
      stages: selectedProfile.catalog,
      exec: "catalogFlow",
    },
    circulation_flow: {
      executor: "ramping-vus",
      startVUs: 0,
      gracefulRampDown: "10s",
      gracefulStop: "20s",
      stages: selectedProfile.circulation,
      exec: "circulationFlow",
    },
    ingestion_flow: {
      executor: "ramping-vus",
      startVUs: 0,
      gracefulRampDown: "10s",
      gracefulStop: "20s",
      stages: selectedProfile.ingestion,
      exec: "ingestionFlow",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.08"],
    checks: ["rate>0.93"],
    "http_req_duration{scenario:auth_flow}": ["p(95)<900"],
    "http_req_duration{scenario:catalog_flow}": ["p(95)<1300"],
    "http_req_duration{scenario:circulation_flow}": ["p(95)<1500"],
    "http_req_duration{scenario:ingestion_flow}": ["p(95)<5000"],
    auth_flow_duration: ["p(95)<1400"],
    catalog_flow_duration: ["p(95)<2200"],
    circulation_flow_duration: ["p(95)<2500"],
    ingestion_flow_duration: ["p(95)<6500"],
  },
};

function parseJson(response) {
  try {
    return response.json();
  } catch (_error) {
    return null;
  }
}

function flattenAvailableCopyIds(catalogPayload) {
  if (!catalogPayload || !Array.isArray(catalogPayload.data)) {
    return [];
  }

  const ids = [];
  for (const book of catalogPayload.data) {
    if (Array.isArray(book.availableCopyIds)) {
      for (const copyId of book.availableCopyIds) {
        if (typeof copyId === "string" && copyId.length > 0) {
          ids.push(copyId);
        }
      }
    }
  }
  return ids;
}

function pickCheckoutCopyId(loansPayload, fallbackCatalogPayload) {
  if (loansPayload && Array.isArray(loansPayload.data) && loansPayload.data.length > 0) {
    const loan = randomItem(loansPayload.data);
    if (loan && loan.bookCopy && typeof loan.bookCopy.id === "string") {
      return { source: "active_loan", copyId: loan.bookCopy.id, loanId: loan.id };
    }
  }

  const copyIds = flattenAvailableCopyIds(fallbackCatalogPayload);
  if (copyIds.length > 0) {
    return { source: "available_pool", copyId: randomItem(copyIds), loanId: null };
  }

  return { source: "none", copyId: null, loanId: null };
}

export function authFlow() {
  const startedAt = Date.now();
  const user = randomItem(AUTH_USERS);
  const session = getSessionForUser(user);

  check(session, {
    "auth flow session established": (value) => value !== null,
  });
  if (!session) {
    sleep(1);
    return;
  }

  const meResponse = http.get(`${BASE_URL}/auth/me`, {
    headers: session.headers,
    tags: { scenario: "auth_flow", endpoint: "auth_me" },
  });

  check(meResponse, {
    "auth flow /auth/me is 200": (res) => res.status === 200,
  });

  const logoutResponse = http.post(`${BASE_URL}/auth/logout`, null, {
    headers: session.headers,
    tags: { scenario: "auth_flow", endpoint: "auth_logout" },
  });
  check(logoutResponse, {
    "auth flow /auth/logout is 200": (res) => res.status === 200,
  });

  authFlowDuration.add(Date.now() - startedAt);
  sleep(Math.random() * 1.5);
}

export function catalogFlow() {
  const startedAt = Date.now();
  const user = pickByVu(AUTH_USERS);
  const session = getSessionForUser(user);
  if (!session) {
    sleep(1);
    return;
  }

  const firstQuery =
    `/books?search=${encodeURIComponent(randomItem(SEARCH_TERMS))}` +
    `&author=${encodeURIComponent(randomItem(AUTHORS))}` +
    `&page=${Math.floor(Math.random() * 3) + 1}&limit=20&sortBy=title&sortDir=asc`;

  const firstResponse = http.get(`${BASE_URL}${firstQuery}`, {
    headers: session.headers,
    tags: { scenario: "catalog_flow", endpoint: "books_search" },
  });

  const firstPayload = parseJson(firstResponse);
  check(firstResponse, {
    "catalog search returns 200": (res) => res.status === 200,
    "catalog search has data array": () =>
      firstPayload !== null && Array.isArray(firstPayload.data),
  });

  const secondQuery =
    `/books?category=${encodeURIComponent(randomItem(CATEGORIES))}` +
    `&status=available&page=1&limit=20&sortBy=dateAdded&sortDir=desc`;
  const secondResponse = http.get(`${BASE_URL}${secondQuery}`, {
    headers: session.headers,
    tags: { scenario: "catalog_flow", endpoint: "books_filter" },
  });

  const secondPayload = parseJson(secondResponse);
  check(secondResponse, {
    "catalog filter returns 200": (res) => res.status === 200,
    "catalog filter has pagination": () =>
      secondPayload !== null && secondPayload.pagination !== undefined,
  });

  if (firstPayload && Array.isArray(firstPayload.data) && firstPayload.data.length > 0) {
    const selectedBook = randomItem(firstPayload.data);
    const detailResponse = http.get(`${BASE_URL}/books/${selectedBook.id}`, {
      headers: session.headers,
      tags: { scenario: "catalog_flow", endpoint: "book_detail" },
    });

    check(detailResponse, {
      "catalog detail returns 200": (res) => res.status === 200,
    });
  }

  catalogFlowDuration.add(Date.now() - startedAt);
  sleep(Math.random() * 1.2);
}

export function circulationFlow() {
  const startedAt = Date.now();
  const user = pickByVu(PATRON_USERS);
  const session = getSessionForUser(user);
  if (!session) {
    sleep(1);
    return;
  }

  const loansResponse = http.get(`${BASE_URL}/loans?status=active&page=1&limit=20`, {
    headers: session.headers,
    tags: { scenario: "circulation_flow", endpoint: "loans_list" },
  });
  check(loansResponse, {
    "circulation list loans returns 200": (res) => res.status === 200,
  });
  const loansPayload = parseJson(loansResponse);

  const availableResponse = http.get(
    `${BASE_URL}/books?status=available&page=${Math.floor(Math.random() * 3) + 1}&limit=30`,
    {
      headers: session.headers,
      tags: { scenario: "circulation_flow", endpoint: "books_available" },
    },
  );

  const availablePayload = parseJson(availableResponse);
  check(availableResponse, {
    "circulation available books returns 200": (res) => res.status === 200,
  });

  const selection = pickCheckoutCopyId(loansPayload, availablePayload);
  if (!selection.copyId) {
    emptyCopyPools.add(1);
    circulationFlowDuration.add(Date.now() - startedAt);
    sleep(Math.random());
    return;
  }

  // When no AVAILABLE pool exists (common in heavily checked-out seeds),
  // check in one active loan first to create a valid checkout candidate.
  if (selection.source === "active_loan" && selection.loanId) {
    const preCheckin = http.post(
      `${BASE_URL}/loans/checkin`,
      JSON.stringify({ loanId: selection.loanId }),
      {
        headers: session.headers,
        tags: { scenario: "circulation_flow", endpoint: "loan_checkin_pre" },
        responseCallback: okOrConflict,
      },
    );

    check(preCheckin, {
      "circulation pre-checkin returns 200 or 409": (res) => res.status === 200 || res.status === 409,
    });
  }

  const checkoutResponse = http.post(
    `${BASE_URL}/loans/checkout`,
    JSON.stringify({ bookCopyId: selection.copyId, dueDays: 14 }),
    {
      headers: session.headers,
      tags: { scenario: "circulation_flow", endpoint: "loan_checkout" },
      responseCallback: createdOrConflict,
    },
  );

  check(checkoutResponse, {
    "circulation checkout returns 201 or 409": (res) => res.status === 201 || res.status === 409,
  });

  if (checkoutResponse.status === 409) {
    checkoutConflicts.add(1);
    circulationFlowDuration.add(Date.now() - startedAt);
    sleep(Math.random());
    return;
  }

  const checkoutPayload = parseJson(checkoutResponse);
  const loanId = checkoutPayload && checkoutPayload.id ? checkoutPayload.id : null;
  check(loanId, {
    "circulation checkout returns loan id": (id) => id !== null,
  });

  if (loanId) {
    const checkinResponse = http.post(
      `${BASE_URL}/loans/checkin`,
      JSON.stringify({ loanId }),
      {
        headers: session.headers,
        tags: { scenario: "circulation_flow", endpoint: "loan_checkin" },
      },
    );

    check(checkinResponse, {
      "circulation checkin returns 200": (res) => res.status === 200,
    });
  }

  circulationFlowDuration.add(Date.now() - startedAt);
  sleep(Math.random() * 1.2);
}

export function ingestionFlow() {
  const startedAt = Date.now();
  const user = pickByVu(STAFF_USERS);
  const session = getSessionForUser(user);
  if (!session) {
    sleep(1);
    return;
  }

  const jobsResponse = http.get(`${BASE_URL}/ingest/jobs?page=1&limit=20`, {
    headers: session.headers,
    tags: { scenario: "ingestion_flow", endpoint: "ingest_jobs" },
  });
  check(jobsResponse, {
    "ingestion list jobs returns 200": (res) => res.status === 200,
  });

  const lookupResponse = http.get(`${BASE_URL}/ingest/lookup?isbn=${randomItem(SEEDED_ISBNS)}`, {
    headers: session.headers,
    tags: { scenario: "ingestion_flow", endpoint: "ingest_lookup" },
  });
  check(lookupResponse, {
    "ingestion isbn lookup returns 200": (res) => res.status === 200,
  });

  const analyzeResponse = http.post(
    `${BASE_URL}/ingest/analyze`,
    { image: http.file(coverImage, "cover.png", "image/png") },
    {
      headers: { Cookie: session.headers.Cookie },
      tags: { scenario: "ingestion_flow", endpoint: "ingest_analyze" },
    },
  );

  check(analyzeResponse, {
    "ingestion analyze returns 200": (res) => res.status === 200,
  });

  const analyzePayload = parseJson(analyzeResponse);
  const jobId =
    analyzePayload &&
    analyzePayload.data &&
    analyzePayload.data.jobId
      ? analyzePayload.data.jobId
      : null;

  check(jobId, {
    "ingestion analyze returns job id": (id) => id !== null,
  });

  if (jobId) {
    const getJobResponse = http.get(`${BASE_URL}/ingest/jobs/${jobId}`, {
      headers: session.headers,
      tags: { scenario: "ingestion_flow", endpoint: "ingest_job_detail" },
    });
    check(getJobResponse, {
      "ingestion get job returns 200": (res) => res.status === 200,
    });

    const rejectResponse = http.post(`${BASE_URL}/ingest/jobs/${jobId}/reject`, null, {
      headers: session.headers,
      tags: { scenario: "ingestion_flow", endpoint: "ingest_job_reject" },
    });
    check(rejectResponse, {
      "ingestion reject returns 200": (res) => res.status === 200,
    });
  }

  ingestionFlowDuration.add(Date.now() - startedAt);
  sleep(Math.random() * 1.5);
}

export const handleSummary = handleSummaryFactory("multi-user");

