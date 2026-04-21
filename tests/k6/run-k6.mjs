import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import fs from "node:fs";

const suiteArg = process.argv[2] || "multi-user";
const profileIndex = process.argv.indexOf("--profile");
const profileArg = profileIndex >= 0 ? process.argv[profileIndex + 1] : undefined;

const suites = {
  smoke: "tests/k6/scenarios/smoke.js",
  "multi-user": "tests/k6/scenarios/multi-user.js",
  load: "tests/k6/scenarios/multi-user.js",
};

const scriptPath = suites[suiteArg];
if (!scriptPath) {
  console.error(`Unknown suite "${suiteArg}". Use one of: ${Object.keys(suites).join(", ")}`);
  process.exit(1);
}

const repoRoot = process.cwd();
const resultsDir = path.join(repoRoot, "tests", "k6", "results");
fs.mkdirSync(resultsDir, { recursive: true });

const k6Env = {
  K6_PROFILE: profileArg || process.env.K6_PROFILE || "task3",
  K6_PASSWORD: process.env.K6_PASSWORD || "password123",
};

function runLocalK6() {
  const env = {
    ...process.env,
    ...k6Env,
    K6_BASE_URL: process.env.K6_BASE_URL || "http://localhost:3001",
  };

  return spawnSync("k6", ["run", scriptPath], {
    stdio: "inherit",
    env,
    shell: false,
  });
}

function runDockerK6() {
  const baseUrl = process.env.K6_BASE_URL || "http://host.docker.internal:3001";
  const dockerScriptPath = `/work/${scriptPath.replace(/\\/g, "/")}`;
  const dockerMountPath = `${repoRoot.replace(/\\/g, "/")}:/work`;

  const args = [
    "run",
    "--rm",
    "-i",
    "-v",
    dockerMountPath,
    "-w",
    "/work",
    "-e",
    `K6_BASE_URL=${baseUrl}`,
    "-e",
    `K6_PROFILE=${k6Env.K6_PROFILE}`,
    "-e",
    `K6_PASSWORD=${k6Env.K6_PASSWORD}`,
    "grafana/k6:0.49.0",
    "run",
    dockerScriptPath,
  ];

  return spawnSync("docker", args, { stdio: "inherit", shell: false });
}

const hasLocalK6 =
  spawnSync("k6", ["version"], {
    stdio: "ignore",
    shell: false,
  }).status === 0;

const result = hasLocalK6 ? runLocalK6() : runDockerK6();

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);
