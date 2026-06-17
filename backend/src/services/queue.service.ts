/**
 * Queue Service
 *
 * Thin wrapper around AWS SQS for the AI processing job queue.
 * - `enqueueJob`     - send a job message (producer)
 * - `receiveMessages` - poll up to N messages (consumer)
 * - `deleteMessage`  - acknowledge / remove a processed message
 */
import {
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { sqsClient } from "../config/sqs.config.js";
import config from "../config/env.config.js";
import { buildQueueJob, parseQueueJob, QueueJob, QueueJobInput } from "../types/queue.types.js";
import { logError, logWarn } from "../utils/logger.js";

export const enqueueJob = async (job: QueueJobInput): Promise<QueueJob> => {
  const enrichedJob = buildQueueJob(job);
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: config.awsConfig.sqs.queueUrl,
      MessageBody: JSON.stringify(enrichedJob),
    }),
  );
  return enrichedJob;
};

export interface SqsMessage {
  body: QueueJob;
  receiptHandle: string;
  messageId: string | null;
  receiveCount: number;
  sentAt: string | null;
}

export const receiveMessages = async (
  maxMessages = 10,
): Promise<SqsMessage[]> => {
  const result = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: config.awsConfig.sqs.queueUrl,
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds: 10,
      VisibilityTimeout: 90,
      MessageSystemAttributeNames: ["ApproximateReceiveCount", "SentTimestamp"],
    }),
  );

  if (!result.Messages || result.Messages.length === 0) return [];

  return result.Messages.flatMap((msg) => {
    if (!msg.Body || !msg.ReceiptHandle) return [];
    const receiveCount = Number(msg.Attributes?.["ApproximateReceiveCount"] ?? "1");
    const sentTimestamp = msg.Attributes?.["SentTimestamp"] ?? null;
    const sentAt = sentTimestamp ? new Date(Number(sentTimestamp)).toISOString() : null;

    try {
      const parsed = parseQueueJob(JSON.parse(msg.Body));
      parsed.meta.attempt = Math.max(parsed.meta.attempt, receiveCount - 1);
      return [{
        body: parsed,
        receiptHandle: msg.ReceiptHandle,
        messageId: msg.MessageId ?? null,
        receiveCount,
        sentAt,
      }];
    } catch (err) {
      logWarn("Dropping malformed SQS message", {
        code: "SQS_MALFORMED_MESSAGE",
        messageId: msg.MessageId,
      });
      deleteMessage(msg.ReceiptHandle).catch((deleteErr) =>
        logError(deleteErr, {
          message: "Failed to delete malformed SQS message",
          code: "SQS_DELETE_MALFORMED_ERROR",
          messageId: msg.MessageId,
        }),
      );
      return [];
    }
  });
};

export const deleteMessage = async (receiptHandle: string): Promise<void> => {
  await sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl: config.awsConfig.sqs.queueUrl,
      ReceiptHandle: receiptHandle,
    }),
  );
};
