import { describe, expect, it } from "vitest";
import {
  buildQueueJob,
  parseQueueJob,
  QueueJobType,
} from "./queue.types.js";

describe("queue job metadata", () => {
  it("adds required metadata to new OCR jobs", () => {
    const job = buildQueueJob({
      jobType: QueueJobType.OcrScan,
      ticketId: "ticket-1",
      receiptId: "receipt-1",
      orgId: "org-1",
      meta: { requestedBy: "user-1" },
    });

    expect(job.meta.jobId).toBeTruthy();
    expect(job.meta.traceId).toBeTruthy();
    expect(job.meta.attempt).toBe(0);
    expect(job.meta.requestedBy).toBe("user-1");
  });

  it("rejects malformed queue messages", () => {
    expect(() => parseQueueJob({ jobType: "unknown" })).toThrow();
  });
});
