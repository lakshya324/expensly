# Deployment Runbook

## Processes

- API server: `cd backend && npm run build && npm start`
- AI/OCR worker: `cd backend && npm run build && npm run start:worker`
- Frontend: `cd frontend && npm run build`
- Scheduled jobs: run inside the API process for budget resets and analytics refresh. The SQS worker is intentionally separate.

## Required Services

- MongoDB 7
- Redis 7
- AWS S3 bucket for receipts and reports
- AWS SQS queue for OCR/AI jobs
- AWS SQS dead-letter queue attached to the main queue
- SMTP provider
- OpenAI API key

## SQS / DLQ Policy

Configure the main SQS queue with:

- Visibility timeout: at least 90 seconds
- Receive wait time: 10 seconds
- Redrive policy: send messages to a DLQ after 3-5 receives

The worker deletes only successful, skipped, malformed, or explicitly non-retryable jobs. Retryable failures remain in SQS and are retried by the queue until the DLQ policy takes over.

## Health Checks

- Liveness: `GET /api/health/live`
- Readiness: `GET /api/health/ready`
- Dependency detail: `GET /api/health/dependencies`

Use readiness for load balancer traffic decisions.

## Secrets And PII

- Never commit `.env`, seed credential JSON, OTPs, tokens, receipt OCR text, or provider secrets.
- Logs are JSON and include request/job correlation IDs. Keep raw receipt text out of logs.
- Rotate `JWT_SECRET`, `JWT_REFRESH_SECRET`, SMTP credentials, OpenAI keys, and AWS keys through the deployment platform.

## Local Infrastructure

Run dependencies and app processes with:

```bash
docker compose up --build
```

For regular development, run MongoDB/Redis locally or through Compose, then run:

```bash
npm run dev --prefix backend
npm run dev:worker --prefix backend
npm run dev --prefix frontend
```

## Rollback

1. Stop new API and worker deployments.
2. Roll API and worker together to the previous image/version.
3. Confirm `GET /api/health/ready` passes.
4. Check worker logs for retryable failures and DLQ growth.
5. If the rollback includes schema changes, run the matching migration or restore from the latest verified MongoDB backup.

## Backups

- Schedule daily MongoDB backups with point-in-time recovery where available.
- Keep Redis ephemeral; do not rely on Redis as source of truth.
- S3 receipt/report objects should use bucket versioning and lifecycle policies.
