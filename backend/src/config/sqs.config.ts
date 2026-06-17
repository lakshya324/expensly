import { SQSClient } from "@aws-sdk/client-sqs";
import config from "./env.config.js";

export const sqsClient = new SQSClient({
  region: config.awsConfig.awsRegion,
  credentials:
    config.awsConfig.awsAccessKeyId && config.awsConfig.awsSecretAccessKey
      ? {
          accessKeyId: config.awsConfig.awsAccessKeyId,
          secretAccessKey: config.awsConfig.awsSecretAccessKey,
        }
      : undefined,
});
