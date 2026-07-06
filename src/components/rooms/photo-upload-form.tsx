"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ImageIcon, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const uploadMessages: Record<string, string> = {
  "missing-config": "Supabase or R2 environment variables are missing.",
  "storage-config": "Cloudflare R2 is not fully configured.",
  "storage-failed": "R2 could not store those photos. Try again.",
  "not-a-member": "Only room members can upload photos here.",
  "no-files": "Choose at least one image to upload.",
  "mismatched-files": "The optimized files did not match their thumbnails.",
  "too-many-files": "Upload up to 12 photos at a time.",
  "unsupported-type": "Only browser-optimizable image files are supported.",
  "unsupported-thumbnail": "A thumbnail could not be generated.",
  "file-too-large": "Each optimized photo must be 15 MB or smaller.",
  "thumbnail-too-large": "Each thumbnail must be 3 MB or smaller.",
  "invalid-dimensions": "The optimized image dimensions were too large.",
  "invalid-thumbnail-dimensions": "The thumbnail dimensions were too large.",
  "metadata-failed": "The files uploaded, but the photo metadata could not be saved.",
};

function getUploadMessage(message?: string, missingConfigKey?: string) {
  if (message === "missing-r2-env" && missingConfigKey) {
    return `Missing ${missingConfigKey}`;
  }

  return (
    uploadMessages[message ?? ""] ?? "We could not upload those photos. Try again."
  );
}

type UploadStatus =
  | "selected"
  | "compressing"
  | "ready"
  | "uploading"
  | "error";

type UploadItem = {
  id: string;
  file: File;
  status: UploadStatus;
  detail: string;
  previewUrl: string;
  optimizedSize?: number;
  thumbnailSize?: number;
};

type OptimizedImage = {
  file: File;
  width: number;
  height: number;
};

type UploadApiFailure = {
  success: false;
  error: string;
  code: string;
};

type PresignedUpload = {
  photoId: string;
  storageKey: string;
  thumbnailStorageKey: string;
  uploadUrl: string;
  thumbnailUploadUrl: string;
};

type UploadMetadata = {
  originalFileName: string;
  contentType: "image/webp";
  thumbnailContentType: "image/webp";
  fileSize: number;
  thumbnailFileSize: number;
  width: number;
  height: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
};

type PreparedUpload = UploadMetadata & {
  itemId: string;
  optimized: OptimizedImage;
  thumbnail: OptimizedImage;
};

type PresignApiResult =
  | {
      success: true;
      uploads: PresignedUpload[];
    }
  | UploadApiFailure;

type FinalizeApiResult =
  | {
      success: true;
      count: number;
    }
  | UploadApiFailure;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function logUploadClient(label: string, value: unknown) {
  console.log(label, value);
}

function logUploadClientError(label: string, value: unknown) {
  console.error(label, value);
}

function getClientUploadErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "We could not upload your photos. Try again.";
  }

  const message = error.message;
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("413") ||
    lowerMessage.includes("payload too large") ||
    lowerMessage.includes("body exceeded") ||
    lowerMessage.includes("request body") ||
    lowerMessage.includes("too large")
  ) {
    return "Upload failed before reaching ClaY. Try a smaller photo first.";
  }

  if (lowerMessage.includes("failed to fetch")) {
    return "Upload failed before reaching ClaY. Check production upload logs.";
  }

  return message || "We could not upload your photos. Try again.";
}

function isUploadApiFailure(value: unknown): value is UploadApiFailure {
  if (!value || typeof value !== "object") {
    return false;
  }

  const result = value as Partial<UploadApiFailure>;

  return (
    result.success === false &&
    typeof result.error === "string" &&
    typeof result.code === "string"
  );
}

function isPresignApiResult(value: unknown): value is PresignApiResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const result = value as Partial<PresignApiResult>;

  if (result.success === true) {
    const uploads = (result as { uploads?: unknown }).uploads;

    return (
      Array.isArray(uploads) &&
      uploads.every(
        (upload) =>
          upload &&
          typeof upload === "object" &&
          typeof (upload as Partial<PresignedUpload>).photoId === "string" &&
          typeof (upload as Partial<PresignedUpload>).storageKey === "string" &&
          typeof (upload as Partial<PresignedUpload>).thumbnailStorageKey ===
            "string" &&
          typeof (upload as Partial<PresignedUpload>).uploadUrl === "string" &&
          typeof (upload as Partial<PresignedUpload>).thumbnailUploadUrl ===
            "string",
      )
    );
  }

  return isUploadApiFailure(value);
}

function isFinalizeApiResult(value: unknown): value is FinalizeApiResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const result = value as Partial<FinalizeApiResult>;

  if (result.success === true) {
    return typeof result.count === "number";
  }

  return isUploadApiFailure(value);
}

async function readJsonResponse(
  response: Response,
  invalidResponseCode: string,
): Promise<unknown> {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    console.error("[upload-non-json-response]", text.slice(0, 500));

    return {
      success: false,
      error: "Upload failed. The server returned an invalid response.",
      code: invalidResponseCode,
    } satisfies UploadApiFailure;
  }
}

async function requestPresignedUploads(
  roomId: string,
  files: UploadMetadata[],
): Promise<PresignApiResult> {
  const response = await fetch(`/api/rooms/${roomId}/photos/presign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ files }),
  });
  const result = await readJsonResponse(response, "presign_non_json_response");

  if (!isPresignApiResult(result)) {
    console.error("[upload-invalid-json-response]", result);

    return {
      success: false,
      error: "Upload failed. The server returned an unexpected response.",
      code: "presign_invalid_json_response",
    };
  }

  if (!response.ok && result.success !== false) {
    return {
      success: false,
      error: `Upload failed with status ${response.status}.`,
      code: "presign_http_failed",
    };
  }

  return result;
}

async function finalizeUploads(
  roomId: string,
  photos: Array<UploadMetadata & Pick<PresignedUpload, "photoId" | "storageKey" | "thumbnailStorageKey">>,
): Promise<FinalizeApiResult> {
  const response = await fetch(`/api/rooms/${roomId}/photos/finalize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ photos }),
  });
  const result = await readJsonResponse(response, "finalize_non_json_response");

  if (!isFinalizeApiResult(result)) {
    console.error("[upload-invalid-json-response]", result);

    return {
      success: false,
      error: "Upload failed. The server returned an unexpected response.",
      code: "finalize_invalid_json_response",
    };
  }

  if (!response.ok && result.success !== false) {
    return {
      success: false,
      error: `Upload failed with status ${response.status}.`,
      code: "finalize_http_failed",
    };
  }

  return result;
}

async function putBlobDirectlyToR2({
  uploadUrl,
  storageKey,
  file,
}: {
  uploadUrl: string;
  storageKey: string;
  file: File;
}) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!response.ok) {
    console.error("[direct-r2-upload-error]", {
      storageKey,
      status: response.status,
      statusText: response.statusText,
    });

    throw new Error("We could not upload your photo to storage. Try again.");
  }
}

function getBaseName(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "photo";
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("This image could not be read by the browser."));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: "image/jpeg" | "image/webp",
  quality: number,
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(`Could not encode ${type}.`));
          return;
        }

        resolve(blob);
      },
      type,
      quality,
    );
  });
}

async function optimizeImage({
  file,
  maxLongEdge,
  type,
  quality,
  suffix,
}: {
  file: File;
  maxLongEdge: number;
  type: "image/jpeg" | "image/webp";
  quality: number;
  suffix: string;
}): Promise<OptimizedImage> {
  const image = await loadImage(file);
  const longEdge = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longEdge > maxLongEdge ? maxLongEdge / longEdge : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", {
    alpha: type === "image/webp",
  });

  if (!context) {
    throw new Error("Canvas rendering is not available.");
  }

  canvas.width = width;
  canvas.height = height;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, type, quality);
  const extension = type === "image/webp" ? "webp" : "jpg";

  return {
    file: new File([blob], `${getBaseName(file.name)}-${suffix}.${extension}`, {
      type,
      lastModified: Date.now(),
    }),
    width,
    height,
  };
}

export function PhotoUploadForm({
  roomId,
  uploadStatus,
  uploadMessage,
  missingConfigKey,
  uploadCount,
}: {
  roomId: string;
  uploadStatus?: string;
  uploadMessage?: string;
  missingConfigKey?: string;
  uploadCount?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [localSuccessCount, setLocalSuccessCount] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadedCount = Number(uploadCount ?? 0);
  const successCount =
    localSuccessCount ??
    (uploadStatus === "success" && items.length === 0 ? uploadedCount : null);

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  const clearUploadQueue = useCallback(() => {
    setItems((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  function failUploadingItems(detail: string) {
    setItems((current) =>
      current.map((item) =>
        item.status === "uploading"
          ? {
              ...item,
              status: "error",
              detail,
            }
          : item,
      ),
    );
  }

  useEffect(() => {
    if (isUploading || (uploadStatus !== "success" && uploadStatus !== "error")) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (uploadStatus === "success") {
        clearUploadQueue();
        setClientError(null);

        router.refresh();
        return;
      }

      const detail = getUploadMessage(uploadMessage, missingConfigKey);

      setItems((current) =>
        current.map((item) =>
          item.status === "uploading"
            ? {
                ...item,
                status: "error",
                detail,
              }
            : item,
        ),
      );
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [
    clearUploadQueue,
    isUploading,
    missingConfigKey,
    router,
    uploadMessage,
    uploadStatus,
  ]);

  function handleFiles(files: FileList | null) {
    setClientError(null);
    setLocalSuccessCount(null);
    items.forEach((item) => URL.revokeObjectURL(item.previewUrl));

    const nextItems = Array.from(files ?? []).map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "selected" as const,
      detail: "Ready to optimize",
      previewUrl: URL.createObjectURL(file),
    }));

    setItems(nextItems);
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    handleFiles(event.dataTransfer.files);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientError(null);

    if (items.length === 0) {
      setClientError("Choose at least one image to upload.");
      return;
    }

    if (items.length > 12) {
      setClientError("Upload up to 12 photos at a time.");
      return;
    }

    setIsUploading(true);
    setLocalSuccessCount(null);

    try {
      const preparedUploads: PreparedUpload[] = [];

      for (const item of items) {
        updateItem(item.id, {
          status: "compressing",
          detail: "Compressing full image",
        });

        const optimized = await optimizeImage({
          file: item.file,
          maxLongEdge: 3200,
          type: "image/webp",
          quality: 0.88,
          suffix: "optimized",
        });

        updateItem(item.id, {
          detail: "Generating thumbnail",
          optimizedSize: optimized.file.size,
        });

        const thumbnail = await optimizeImage({
          file: item.file,
          maxLongEdge: 800,
          type: "image/webp",
          quality: 0.78,
          suffix: "thumb",
        });

        updateItem(item.id, {
          status: "ready",
          detail: "Optimized and ready",
          thumbnailSize: thumbnail.file.size,
        });

        preparedUploads.push({
          itemId: item.id,
          originalFileName: item.file.name,
          contentType: "image/webp",
          thumbnailContentType: "image/webp",
          fileSize: optimized.file.size,
          thumbnailFileSize: thumbnail.file.size,
          width: optimized.width,
          height: optimized.height,
          thumbnailWidth: thumbnail.width,
          thumbnailHeight: thumbnail.height,
          optimized,
          thumbnail,
        });
      }

      setItems((current) =>
        current.map((item) => ({
          ...item,
          status: "uploading",
          detail: "Preparing direct upload",
        })),
      );

      logUploadClient("[upload-client-start]", {
        roomId,
        fileCount: preparedUploads.length,
        fileNames: preparedUploads.map((upload) => upload.originalFileName),
        optimizedFileSizes: preparedUploads.map((upload) => upload.fileSize),
        thumbnailFileSizes: preparedUploads.map(
          (upload) => upload.thumbnailFileSize,
        ),
      });

      const presignResult = await requestPresignedUploads(
        roomId,
        preparedUploads.map(
          ({
            originalFileName,
            contentType,
            thumbnailContentType,
            fileSize,
            thumbnailFileSize,
            width,
            height,
            thumbnailWidth,
            thumbnailHeight,
          }) => ({
            originalFileName,
            contentType,
            thumbnailContentType,
            fileSize,
            thumbnailFileSize,
            width,
            height,
            thumbnailWidth,
            thumbnailHeight,
          }),
        ),
      );

      logUploadClient("[upload-client-presign-result]", {
        success: presignResult.success,
        count:
          presignResult.success === true
            ? presignResult.uploads.length
            : undefined,
        code: presignResult.success === false ? presignResult.code : undefined,
      });

      if (presignResult.success === false) {
        setClientError(presignResult.error);
        failUploadingItems("Upload failed");
        return;
      }

      if (presignResult.uploads.length !== preparedUploads.length) {
        setClientError("Upload failed. The server returned an unexpected response.");
        failUploadingItems("Upload failed");
        return;
      }

      for (const [index, upload] of preparedUploads.entries()) {
        const presignedUpload = presignResult.uploads[index];

        updateItem(upload.itemId, {
          detail: "Uploading optimized photo",
        });

        await putBlobDirectlyToR2({
          uploadUrl: presignedUpload.uploadUrl,
          storageKey: presignedUpload.storageKey,
          file: upload.optimized.file,
        });

        updateItem(upload.itemId, {
          detail: "Uploading thumbnail",
        });

        await putBlobDirectlyToR2({
          uploadUrl: presignedUpload.thumbnailUploadUrl,
          storageKey: presignedUpload.thumbnailStorageKey,
          file: upload.thumbnail.file,
        });
      }

      const finalizeResult = await finalizeUploads(
        roomId,
        preparedUploads.map((upload, index) => {
          const presignedUpload = presignResult.uploads[index];

          return {
            photoId: presignedUpload.photoId,
            storageKey: presignedUpload.storageKey,
            thumbnailStorageKey: presignedUpload.thumbnailStorageKey,
            originalFileName: upload.originalFileName,
            contentType: upload.contentType,
            thumbnailContentType: upload.thumbnailContentType,
            fileSize: upload.fileSize,
            thumbnailFileSize: upload.thumbnailFileSize,
            width: upload.width,
            height: upload.height,
            thumbnailWidth: upload.thumbnailWidth,
            thumbnailHeight: upload.thumbnailHeight,
          };
        }),
      );

      logUploadClient("[upload-client-result]", finalizeResult ?? null);

      if (finalizeResult.success === false) {
        setClientError(finalizeResult.error);
        failUploadingItems("Upload failed");
        return;
      }

      if (finalizeResult.success === true) {
        clearUploadQueue();
        setClientError(null);
        setLocalSuccessCount(finalizeResult.count);
        router.refresh();
      }
    } catch (error) {
      console.error("Unable to upload photos", error);
      logUploadClientError("[upload-client-catch]", error);
      setClientError(getClientUploadErrorMessage(error));
      setItems((current) =>
        current.map((item) =>
          item.status === "compressing"
            ? { ...item, status: "error", detail: "Optimization failed" }
            : item.status === "uploading"
              ? { ...item, status: "error", detail: "Upload failed" }
            : item,
        ),
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-card/72 p-5 shadow-[0_18px_70px_rgb(0_0_0_/_0.14)] backdrop-blur transition duration-300 hover:border-foreground/14 sm:p-6 dark:bg-white/[0.04]">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Your view
        </p>
        <h2 className="mt-2 text-2xl leading-tight">Add your perspective</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Add the moments only you saw.
        </p>
      </div>
      <div className="grid gap-4">
        {successCount !== null ? (
          <div className="rounded-md border border-[color-mix(in_oklch,var(--accent),var(--foreground)_10%)] bg-accent/60 px-4 py-3 text-sm text-accent-foreground">
            {successCount > 1
              ? `${successCount} photos uploaded.`
              : "Photo uploaded."}
          </div>
        ) : null}
        {uploadStatus === "error" ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {getUploadMessage(uploadMessage, missingConfigKey)}
          </div>
        ) : null}
        {clientError ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {clientError}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-3">
            <Input
              ref={inputRef}
              id="photos"
              name="photos"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              multiple
              onChange={(event) => handleFiles(event.currentTarget.files)}
              className="sr-only"
            />
            <label
              htmlFor="photos"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              className="group grid min-h-56 cursor-pointer place-items-center rounded-[1.5rem] border border-dashed border-foreground/14 bg-background/50 px-6 py-8 text-center transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/28 hover:bg-muted/24 dark:bg-black/22"
            >
              <span className="grid justify-items-center gap-4">
                <span className="grid size-12 place-items-center rounded-full border border-foreground/10 bg-card/80 text-muted-foreground shadow-sm transition-colors duration-300 group-hover:text-foreground dark:bg-white/[0.045]">
                  <UploadCloud className="size-5" />
                </span>
                <span>
                  <span className="block text-base text-foreground">
                    Choose photos
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    or drag them here
                  </span>
                </span>
                <span className="max-w-sm text-xs leading-5 text-muted-foreground">
                  Browser optimization creates a premium 3200px WebP image and
                  800px thumbnail before upload.
                </span>
              </span>
            </label>
          </div>

          {items.length > 0 ? (
            <div className="grid gap-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-background/58 p-3 text-sm shadow-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative size-12 overflow-hidden rounded-xl bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.previewUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                      <div className="absolute inset-0 grid place-items-center bg-black/18">
                        {item.status === "compressing" ||
                        item.status === "uploading" ? (
                          <Loader2 className="size-4 animate-spin text-white" />
                        ) : item.status === "ready" ? (
                          <CheckCircle2 className="size-4 text-white" />
                        ) : (
                          <ImageIcon className="size-4 text-white" />
                        )}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.file.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <p>{formatBytes(item.file.size)}</p>
                    {item.optimizedSize && item.thumbnailSize ? (
                      <p>
                        {formatBytes(item.optimizedSize)} +{" "}
                        {formatBytes(item.thumbnailSize)}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={isUploading || items.some((item) => item.status === "uploading")}
            className="h-12 w-full rounded-full border border-black/10 bg-foreground px-6 text-background shadow-[inset_0_1px_0_rgb(255_255_255_/_0.22),0_10px_30px_rgb(0_0_0_/_0.10)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-foreground hover:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.28),0_16px_42px_rgb(0_0_0_/_0.14)] active:translate-y-0 active:scale-[0.985] sm:w-fit dark:border-white/20 dark:bg-[#f7efe0] dark:text-black dark:hover:bg-white"
          >
            {isUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UploadCloud className="size-4" />
            )}
            {isUploading ? "Uploading..." : "Optimize and upload"}
          </Button>
        </form>
      </div>
    </section>
  );
}
