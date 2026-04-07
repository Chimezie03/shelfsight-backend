# AWS CloudWatch — monitoring & alerting (Task 5 scaffolding)

This project emits **stdout JSON** lines in production suitable for **CloudWatch Logs** (ECS, Lambda, Elastic Beanstalk, or log-forwarding from Render/Railway/etc.).

## Log fields

### HTTP access (`NODE_ENV=production`)

Example line:

```json
{"level":"info","ts":"2026-04-07T12:00:00.000Z","service":"shelfsight-backend","event":"http_request","method":"GET","path":"/health","statusCode":200,"durationMs":2}
```

### Errors (global handler)

```json
{"level":"error","ts":"...","service":"shelfsight-backend","event":"unhandled_error","name":"Error","message":"...","path":"/books","statusCode":500,"code":"INTERNAL_ERROR","stackPreview":"..."}
```

## Metric filters (examples)

Create **metric filters** on the log group (console or IaC):

1. **5xx rate** — pattern `statusCode` 5xx on `http_request` events (or filter `statusCode >= 500`).
2. **Error log count** — pattern `"level":"error"` and `"event":"unhandled_error"`.
3. **Latency** — parse `durationMs` from `http_request` (optional; use **X-Ray** or **Application Signals** for richer APM if approved later).

## Alarms (manual / IaC)

Suggested alarms (narrow scope):

| Alarm | Source | Condition |
|-------|--------|-----------|
| High5xx | Metric filter on 5xx | > N per 5 minutes |
| ErrorSpike | Metric filter on error logs | > M per 5 minutes |
| HealthCheckFailed | ALB/Route53 or synthetic | `/health` not 200 |

**Infrastructure template:** add alarms in Terraform/CDK or AWS Console using your team’s AWS account. No account IDs or ARNs are committed to this repo.

## Health checks

- **Liveness:** `GET /health` — no DB.
- **Readiness:** `GET /health/ready` — DB `SELECT 1`; returns **503** if DB down (use for ALB target group health if appropriate).

## Required manual steps

1. Create log group for the service (ECS task definition log driver, or ship stdout from container host).
2. Subscribe metric filters to CloudWatch metrics.
3. Create SNS topic + alarm actions for on-call email / Slack (use AWS Chatbot if desired).
