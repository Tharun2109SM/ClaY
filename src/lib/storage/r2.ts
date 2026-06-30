import { S3Client } from "@aws-sdk/client-s3";

let r2Client: S3Client | null = null;

export const r2EnvVariableNames = [
  "CLOUDFLARE_R2_ACCOUNT_ID",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_R2_BUCKET_NAME",
  "CLOUDFLARE_R2_PUBLIC_BASE_URL",
] as const;

export type R2EnvVariableName = (typeof r2EnvVariableNames)[number];

export class R2ConfigurationError extends Error {
  missingVariables: R2EnvVariableName[];

  constructor(missingVariables: R2EnvVariableName[]) {
    super(`Missing ${missingVariables.join(", ")}`);
    this.name = "R2ConfigurationError";
    this.missingVariables = missingVariables;
  }
}

export function getMissingR2EnvVariables() {
  return r2EnvVariableNames.filter((name) => !process.env[name]);
}

export function assertR2Configured() {
  const missingVariables = getMissingR2EnvVariables();

  if (missingVariables.length > 0) {
    throw new R2ConfigurationError(missingVariables);
  }
}

export function getR2Client() {
  if (!r2Client) {
    const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;

    if (
      !accountId ||
      !process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
      !process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
    ) {
      throw new R2ConfigurationError(getMissingR2EnvVariables());
    }

    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
    });
  }

  return r2Client;
}

export function getR2BucketName() {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;

  if (!bucket) {
    throw new R2ConfigurationError(["CLOUDFLARE_R2_BUCKET_NAME"]);
  }

  return bucket;
}

export function getPhotoPublicUrl(storageKey: string) {
  const baseUrl = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL;

  if (!baseUrl) {
    return null;
  }

  return `${baseUrl.replace(/\/$/, "")}/${storageKey}`;
}
