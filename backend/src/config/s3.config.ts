import { S3Client } from "@aws-sdk/client-s3";
import config from "./env.config.js";

export const s3Client = new S3Client({
  region: config.awsConfig.awsRegion,
  credentials:
    config.awsConfig.awsAccessKeyId && config.awsConfig.awsSecretAccessKey
      ? {
          accessKeyId: config.awsConfig.awsAccessKeyId,
          secretAccessKey: config.awsConfig.awsSecretAccessKey,
        }
      : undefined,
});