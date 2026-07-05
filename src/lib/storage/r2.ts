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

const r2EnvAliases: Record<R2EnvVariableName, string[]> = {
  CLOUDFLARE_R2_ACCOUNT_ID: ["CLOUDFLARE_R2_ACCOUNT_ID", "R2_ACCOUNT_ID"],
  CLOUDFLARE_R2_ACCESS_KEY_ID: [
    "CLOUDFLARE_R2_ACCESS_KEY_ID",
    "R2_ACCESS_KEY_ID",
  ],
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: [
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    "R2_SECRET_ACCESS_KEY",
  ],
  CLOUDFLARE_R2_BUCKET_NAME: ["CLOUDFLARE_R2_BUCKET_NAME", "R2_BUCKET_NAME"],
  CLOUDFLARE_R2_PUBLIC_BASE_URL: [
    "CLOUDFLARE_R2_PUBLIC_BASE_URL",
    "R2_PUBLIC_URL",
    "R2_PUBLIC_BASE_URL",
  ],
};

export class R2ConfigurationError extends Error {
  missingVariables: R2EnvVariableName[];

  constructor(missingVariables: R2EnvVariableName[]) {
    super(`Missing ${missingVariables.join(", ")}`);
    this.name = "R2ConfigurationError";
    this.missingVariables = missingVariables;
  }
}

export function getR2Env(name: R2EnvVariableName) {
  for (const variableName of r2EnvAliases[name]) {
    const value = process.env[variableName];

    if (value) {
      return value;
    }
  }

  return null;
}

export function getMissingR2EnvVariables() {
  return r2EnvVariableNames.filter((name) => !getR2Env(name));
}

export function assertR2Configured() {
  const missingVariables = getMissingR2EnvVariables();

  if (missingVariables.length > 0) {
    throw new R2ConfigurationError(missingVariables);
  }
}

export function getR2Client() {
  if (!r2Client) {
    const accountId = getR2Env("CLOUDFLARE_R2_ACCOUNT_ID");
    const accessKeyId = getR2Env("CLOUDFLARE_R2_ACCESS_KEY_ID");
    const secretAccessKey = getR2Env("CLOUDFLARE_R2_SECRET_ACCESS_KEY");

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new R2ConfigurationError(getMissingR2EnvVariables());
    }

    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  return r2Client;
}

export function getR2BucketName() {
  const bucket = getR2Env("CLOUDFLARE_R2_BUCKET_NAME");

  if (!bucket) {
    throw new R2ConfigurationError(["CLOUDFLARE_R2_BUCKET_NAME"]);
  }

  return bucket;
}

export function getPhotoPublicUrl(storageKey: string) {
  const baseUrl = getR2Env("CLOUDFLARE_R2_PUBLIC_BASE_URL");

  if (!baseUrl) {
    return null;
  }

  return `${baseUrl.replace(/\/$/, "")}/${storageKey}`;
}
