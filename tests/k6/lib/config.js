export const BASE_URL = (__ENV.K6_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
export const PASSWORD = __ENV.K6_PASSWORD || "password123";
export const PROFILE = __ENV.K6_PROFILE || "task3";

export const AUTH_USERS = [
  { email: "admin@shelfsight.com", role: "ADMIN" },
  { email: "maria.staff@shelfsight.com", role: "STAFF" },
  { email: "john.staff@shelfsight.com", role: "STAFF" },
  { email: "liam.staff@shelfsight.com", role: "STAFF" },
  { email: "patron1@shelfsight.com", role: "PATRON" },
  { email: "patron2@shelfsight.com", role: "PATRON" },
  { email: "patron3@shelfsight.com", role: "PATRON" },
  { email: "patron4@shelfsight.com", role: "PATRON" },
  { email: "patron5@shelfsight.com", role: "PATRON" },
  { email: "patron6@shelfsight.com", role: "PATRON" },
];

export const STAFF_USERS = AUTH_USERS.filter((user) => user.role === "ADMIN" || user.role === "STAFF");
export const PATRON_USERS = AUTH_USERS.filter((user) => user.role === "PATRON");

export const SEARCH_TERMS = [
  "history",
  "science",
  "fiction",
  "art",
  "code",
  "war",
  "time",
  "world",
  "the",
  "a",
];

export const AUTHORS = [
  "Tolstoy",
  "Austen",
  "Orwell",
  "Hawking",
  "Asimov",
  "Homer",
  "Kahneman",
  "Darwin",
];

export const CATEGORIES = [
  "all",
  "Science",
  "Technology",
  "History & Geography",
  "Arts & Recreation",
  "Literature",
];

export const SEEDED_ISBNS = [
  "9780743273565",
  "9780060935467",
  "9780451524935",
  "9780553380163",
  "9780062316097",
  "9780132350884",
  "9780262033848",
];

export function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function pickByVu(items) {
  return items[((__VU || 1) - 1) % items.length];
}

