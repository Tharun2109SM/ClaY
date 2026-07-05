"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ImageIcon, Loader2, UploadCloud } from "lucide-react";
import { uploadPhotosAction } from "@/app/actions";
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

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadedCount = Number(uploadCount ?? 0);

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  useEffect(() => {
    if (isPending || (uploadStatus !== "success" && uploadStatus !== "error")) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (uploadStatus === "success") {
        setItems((current) => {
          current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
          return [];
        });
        setClientError(null);

        if (inputRef.current) {
          inputRef.current.value = "";
        }

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
  }, [isPending, missingConfigKey, router, uploadMessage, uploadStatus]);

  function handleFiles(files: FileList | null) {
    setClientError(null);
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

    const formData = new FormData();
    formData.append("room_id", roomId);

    try {
      for (const item of items) {
        updateItem(item.id, {
          status: "compressing",
          detail: "Compressing full image",
        });

        const optimized = await optimizeImage({
          file: item.file,
          maxLongEdge: 2400,
          type: "image/webp",
          quality: 0.82,
          suffix: "optimized",
        });

        updateItem(item.id, {
          detail: "Generating thumbnail",
          optimizedSize: optimized.file.size,
        });

        const thumbnail = await optimizeImage({
          file: item.file,
          maxLongEdge: 600,
          type: "image/webp",
          quality: 0.75,
          suffix: "thumb",
        });

        updateItem(item.id, {
          status: "ready",
          detail: "Optimized and ready",
          thumbnailSize: thumbnail.file.size,
        });

        formData.append("photos", optimized.file);
        formData.append("thumbnails", thumbnail.file);
        formData.append("original_file_names", item.file.name);
      }

      setItems((current) =>
        current.map((item) => ({
          ...item,
          status: "uploading",
          detail: "Uploading to ClaY",
        })),
      );

      startTransition(() => {
        void uploadPhotosAction(formData);
      });
    } catch (error) {
      console.error("Unable to optimize photos", error);
      setClientError(
        error instanceof Error
          ? error.message
          : "We could not optimize those images.",
      );
      setItems((current) =>
        current.map((item) =>
          item.status === "compressing"
            ? { ...item, status: "error", detail: "Optimization failed" }
            : item,
        ),
      );
    }
  }

  return (
    <section className="rounded-3xl border bg-card p-5 shadow-none sm:p-6">
      <div className="mb-5">
        <h2 className="text-xl leading-tight">Add your perspective</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Upload the photos you saw through your lens.
        </p>
      </div>
      <div className="grid gap-4">
        {uploadStatus === "success" ? (
          <div className="rounded-md border border-[color-mix(in_oklch,var(--accent),var(--foreground)_10%)] bg-accent/60 px-4 py-3 text-sm text-accent-foreground">
            {uploadedCount > 1
              ? `${uploadedCount} photos uploaded.`
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
              className="group grid min-h-52 cursor-pointer place-items-center rounded-3xl border border-dashed bg-background/40 px-6 py-8 text-center transition-all duration-300 hover:border-foreground/25 hover:bg-muted/30"
            >
              <span className="grid justify-items-center gap-4">
                <span className="grid size-12 place-items-center rounded-full border bg-card text-muted-foreground transition-colors duration-300 group-hover:text-foreground">
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
                  Browser optimization creates a 2400px image and 600px WebP
                  thumbnail before upload.
                </span>
              </span>
            </label>
          </div>

          {items.length > 0 ? (
            <div className="grid gap-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border bg-background/50 p-3 text-sm"
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
            disabled={isPending || items.some((item) => item.status === "uploading")}
            className="h-12 w-full rounded-full border border-black/10 bg-foreground px-6 text-background shadow-[inset_0_1px_0_rgb(255_255_255_/_0.22),0_10px_30px_rgb(0_0_0_/_0.10)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-foreground hover:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.28),0_16px_42px_rgb(0_0_0_/_0.14)] active:translate-y-0 active:scale-[0.985] sm:w-fit dark:border-white/20 dark:bg-[#f7efe0] dark:text-black dark:hover:bg-[#f7efe0]"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UploadCloud className="size-4" />
            )}
            {isPending ? "Uploading..." : "Optimize and upload"}
          </Button>
        </form>
      </div>
    </section>
  );
}
