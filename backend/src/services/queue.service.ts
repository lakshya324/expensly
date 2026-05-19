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
import { QueueJob } from "../types/queue.types.js";

export const enqueueJob = async (job: QueueJob): Promise<void> => {
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: config.awsConfig.sqs.queueUrl,
      MessageBody: JSON.stringify(job),
    }),
  );
};

export interface SqsMessage {
  body: QueueJob;
  receiptHandle: string;
}

export const receiveMessages = async (
  maxMessages = 10,
): Promise<SqsMessage[]> => {
  const result = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: config.awsConfig.sqs.queueUrl,
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds: 0,
      VisibilityTimeout: 90,
    }),
  );

  if (!result.Messages || result.Messages.length === 0) return [];

  return result.Messages.flatMap((msg) => {
    if (!msg.Body || !msg.ReceiptHandle) return [];
    try {
      return [{ body: JSON.parse(msg.Body) as QueueJob, receiptHandle: msg.ReceiptHandle }];
    } catch {
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
