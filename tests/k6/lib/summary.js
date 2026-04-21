function formatNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "n/a";
  }
  return value.toFixed(2);
}

function readMetric(data, metricName) {
  return data.metrics && data.metrics[metricName] ? data.metrics[metricName].values || {} : {};
}

export function buildSummary(name, data) {
  const durations = readMetric(data, "http_req_duration");
  const failed = readMetric(data, "http_req_failed");
  const checks = readMetric(data, "checks");
  const iterations = readMetric(data, "iterations");
  const vus = readMetric(data, "vus_max");

  return {
    suite: name,
    generatedAt: new Date().toISOString(),
    http: {
      p90Ms: typeof durations["p(90)"] === "number" ? durations["p(90)"] : null,
      p95Ms: typeof durations["p(95)"] === "number" ? durations["p(95)"] : null,
      p99Ms: typeof durations["p(99)"] === "number" ? durations["p(99)"] : null,
      avgMs: typeof durations.avg === "number" ? durations.avg : null,
      maxMs: typeof durations.max === "number" ? durations.max : null,
      reqFailedRate: typeof failed.rate === "number" ? failed.rate : null,
    },
    checks: {
      passRate: typeof checks.rate === "number" ? checks.rate : null,
      passes: typeof checks.passes === "number" ? checks.passes : null,
      fails: typeof checks.fails === "number" ? checks.fails : null,
    },
    execution: {
      iterations: typeof iterations.count === "number" ? iterations.count : null,
      maxVUs: typeof vus.value === "number" ? vus.value : null,
    },
  };
}

function toMarkdown(summary) {
  return [
    `# k6 Summary: ${summary.suite}`,
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    "## HTTP",
    `- p90: ${formatNumber(summary.http.p90Ms)} ms`,
    `- p95: ${formatNumber(summary.http.p95Ms)} ms`,
    `- p99: ${formatNumber(summary.http.p99Ms)} ms`,
    `- avg: ${formatNumber(summary.http.avgMs)} ms`,
    `- max: ${formatNumber(summary.http.maxMs)} ms`,
    `- failed rate: ${formatNumber((summary.http.reqFailedRate || 0) * 100)}%`,
    "",
    "## Checks",
    `- pass rate: ${formatNumber((summary.checks.passRate || 0) * 100)}%`,
    `- passes: ${summary.checks.passes !== null ? summary.checks.passes : "n/a"}`,
    `- fails: ${summary.checks.fails !== null ? summary.checks.fails : "n/a"}`,
    "",
    "## Execution",
    `- iterations: ${summary.execution.iterations !== null ? summary.execution.iterations : "n/a"}`,
    `- max VUs: ${summary.execution.maxVUs !== null ? summary.execution.maxVUs : "n/a"}`,
    "",
  ].join("\n");
}

export function handleSummaryFactory(name) {
  return function handleSummary(data) {
    const summary = buildSummary(name, data);
    return {
      [`tests/k6/results/${name}-summary.json`]: JSON.stringify(summary, null, 2),
      [`tests/k6/results/${name}-raw.json`]: JSON.stringify(data, null, 2),
      [`tests/k6/results/${name}-summary.md`]: toMarkdown(summary),
    };
  };
}
