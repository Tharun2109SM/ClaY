"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const CAPTURE_ERROR_MESSAGE =
  "Could not capture photobook pages. Please refresh and try again.";
const IMAGE_WAIT_TIMEOUT_MS = 5000;
const PDF_PAGE_WIDTH = 1200;
const PDF_PAGE_HEIGHT = 1500;

type ExportPage = {
  element: HTMLElement;
  label: string;
  id: string;
  order: number;
};

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "photobook"
  );
}

const safeThemeVariables = {
  "--background": "#050505",
  "--foreground": "#ffffff",
  "--card": "#050505",
  "--card-foreground": "#ffffff",
  "--muted": "#171717",
  "--muted-foreground": "#a3a3a3",
  "--accent": "#1f1f1f",
  "--accent-foreground": "#ffffff",
  "--border": "rgba(255, 255, 255, 0.16)",
  "--input": "rgba(255, 255, 255, 0.16)",
  "--ring": "rgba(255, 255, 255, 0.32)",
};

function hasUnsupportedColorFunction(value: string) {
  return /\b(?:oklch|oklab|lab|lch|color|color-mix)\(/i.test(value);
}

function applyExportSafeVariables(element: HTMLElement) {
  for (const [name, value] of Object.entries(safeThemeVariables)) {
    element.style.setProperty(name, value);
  }
}

function nextAnimationFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function logPdfExport(message: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[photobook-pdf] ${message}`, details ?? {});
  }
}

async function waitForFonts() {
  if ("fonts" in document) {
    await document.fonts.ready;
  }
}

function waitForImage(image: HTMLImageElement) {
  if (image.complete && image.naturalWidth > 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, IMAGE_WAIT_TIMEOUT_MS);

    function settle() {
      window.clearTimeout(timeout);
      resolve();
    }

    image.addEventListener("load", settle, { once: true });
    image.addEventListener("error", settle, { once: true });
  });
}

async function waitForImages(rootElement: HTMLElement) {
  const images = Array.from(rootElement.querySelectorAll<HTMLImageElement>("img"));

  for (const image of images) {
    image.crossOrigin = "anonymous";

    if (image.loading === "lazy") {
      image.loading = "eager";
    }
  }

  await Promise.all(images.map(waitForImage));
}

function sanitizePhotobookClone(documentClone: Document) {
  const view = documentClone.defaultView;

  if (!view) {
    return;
  }

  applyExportSafeVariables(documentClone.documentElement);
  documentClone.body.style.backgroundColor = "#ffffff";
  documentClone.body.style.color = "#050505";

  const pages = Array.from(
    documentClone.querySelectorAll<HTMLElement>("[data-photobook-page='true']"),
  );
  const isDarkTheme = documentClone.documentElement.classList.contains("dark");

  for (const page of pages) {
    const isCreditPage = page.dataset.photobookPageKind === "credit";
    const pageStyles = view.getComputedStyle(page);
    const computedBackground = pageStyles.backgroundColor;
    const computedColor = pageStyles.color;
    const pageBackground =
      isCreditPage && !computedBackground
        ? isDarkTheme
          ? "#050505"
          : "#ffffff"
        : !computedBackground ||
            computedBackground === "rgba(0, 0, 0, 0)" ||
            hasUnsupportedColorFunction(computedBackground)
          ? "#050505"
          : computedBackground;
    const pageColor =
      isCreditPage && !computedColor
        ? isDarkTheme
          ? "#f7efe0"
          : "#050505"
        : !computedColor || hasUnsupportedColorFunction(computedColor)
          ? "#ffffff"
          : computedColor;
    const pageBorderColor = isCreditPage
      ? isDarkTheme
        ? "rgba(255, 255, 255, 0.14)"
        : "rgba(0, 0, 0, 0.10)"
      : "transparent";

    page.classList.add("photobook-export-safe");
    applyExportSafeVariables(page);
    page.style.position = "relative";
    page.style.inset = "auto";
    page.style.left = "0";
    page.style.top = "0";
    page.style.margin = "0";
    page.style.width = `${PDF_PAGE_WIDTH}px`;
    page.style.height = `${PDF_PAGE_HEIGHT}px`;
    page.style.minWidth = `${PDF_PAGE_WIDTH}px`;
    page.style.minHeight = `${PDF_PAGE_HEIGHT}px`;
    page.style.maxWidth = `${PDF_PAGE_WIDTH}px`;
    page.style.aspectRatio = "4 / 5";
    page.style.backgroundColor = pageBackground;
    page.style.color = pageColor;
    page.style.borderColor = pageBorderColor;
    page.style.boxShadow = "none";
    page.style.opacity = "1";
    page.style.transform = "none";
    page.style.filter = "none";
    page.style.mixBlendMode = "normal";

    const elements = [page, ...Array.from(page.querySelectorAll<HTMLElement>("*"))];

    for (const element of elements) {
      const styles = view.getComputedStyle(element);

      element.style.opacity = "1";
      element.style.filter = "none";
      element.style.backdropFilter = "none";
      element.style.mixBlendMode = "normal";

      if (hasUnsupportedColorFunction(styles.color)) {
        element.style.color = element === page ? pageColor : "inherit";
      }

      if (hasUnsupportedColorFunction(styles.backgroundColor)) {
        element.style.backgroundColor =
          element === page ? pageBackground : "transparent";
      }

      if (hasUnsupportedColorFunction(styles.borderTopColor)) {
        element.style.borderTopColor = pageBorderColor;
      }

      if (hasUnsupportedColorFunction(styles.borderRightColor)) {
        element.style.borderRightColor = pageBorderColor;
      }

      if (hasUnsupportedColorFunction(styles.borderBottomColor)) {
        element.style.borderBottomColor = pageBorderColor;
      }

      if (hasUnsupportedColorFunction(styles.borderLeftColor)) {
        element.style.borderLeftColor = pageBorderColor;
      }

      if (hasUnsupportedColorFunction(styles.outlineColor)) {
        element.style.outlineColor = "rgba(255, 255, 255, 0.32)";
      }

      if (hasUnsupportedColorFunction(styles.textDecorationColor)) {
        element.style.textDecorationColor = "rgba(255, 255, 255, 0.72)";
      }

      if (hasUnsupportedColorFunction(styles.boxShadow)) {
        element.style.boxShadow = "none";
      }
    }
  }
}

async function capturePhotobookPage(
  page: ExportPage,
  html2canvas: typeof import("html2canvas").default,
) {
  const pageElement = page.element;
  const rect = pageElement.getBoundingClientRect();

  logPdfExport("page dimensions before capture", {
    label: page.label,
    width: rect.width,
    height: rect.height,
  });

  if (rect.width === 0 || rect.height === 0) {
    throw new Error(`Could not capture ${page.label}.`);
  }

  await waitForImages(pageElement);
  await nextAnimationFrame();

  const canvas = await html2canvas(pageElement, {
    backgroundColor: null,
    scale: 2,
    width: rect.width,
    height: rect.height,
    useCORS: true,
    allowTaint: false,
    logging: false,
    onclone: sanitizePhotobookClone,
  });

  logPdfExport("canvas dimensions after capture", {
    label: page.label,
    width: canvas.width,
    height: canvas.height,
  });

  if (canvas.width === 0 || canvas.height === 0) {
    throw new Error(`Could not capture ${page.label}.`);
  }

  return canvas;
}

function getExportPages() {
  const exportCopies = Array.from(
    document.querySelectorAll<HTMLElement>(
      "[data-photobook-page='true'][data-photobook-export-copy='true']",
    ),
  );
  const sourceElements =
    exportCopies.length > 0
      ? exportCopies
      : Array.from(document.querySelectorAll<HTMLElement>("[data-photobook-page='true']"));

  const pages = sourceElements
    .map((element, index) => {
      const rect = element.getBoundingClientRect();
      const fallbackLabel =
        index === 0
          ? "cover page"
          : index === 1
            ? "people page"
            : `photo page ${index - 1}`;

      return {
        element,
        id: element.dataset.photobookPageId ?? `page-${index}`,
        label: element.dataset.photobookPageLabel ?? fallbackLabel,
        order: Number(element.dataset.photobookPageOrder ?? index + 1),
        isExportCopy: element.dataset.photobookExportCopy === "true",
        width: rect.width,
        height: rect.height,
      };
    })
    .filter((page) => page.width > 0 && page.height > 0)
    .sort((first, second) => {
      if (first.order !== second.order) {
        return first.order - second.order;
      }

      if (first.isExportCopy !== second.isExportCopy) {
        return first.isExportCopy ? -1 : 1;
      }

      return 0;
    });
  const dedupedPages = new Map<string, (typeof pages)[number]>();

  for (const page of pages) {
    if (!dedupedPages.has(page.id)) {
      dedupedPages.set(page.id, page);
    }
  }

  const exportPages = Array.from(dedupedPages.values()).map(
    ({ element, id, label, order }) => ({
      element,
      id,
      label,
      order,
    }),
  );
  logPdfExport("export pages resolved", {
    source: exportCopies.length > 0 ? "fixed export copies" : "visible fallback",
    count: exportPages.length,
    order: exportPages.map((page) => ({
      id: page.id,
      label: page.label,
      order: page.order,
      kind: page.element.dataset.photobookPageKind,
    })),
  });

  return exportPages;
}

export function DownloadPdfButton({
  roomName,
  disabled = false,
  onBeforeDownload,
}: {
  roomName: string;
  disabled?: boolean;
  onBeforeDownload?: () => Promise<void> | void;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setStatus("loading");
    setError(null);
    let isExporting = false;

    try {
      await onBeforeDownload?.();
      await nextAnimationFrame();

      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      await nextAnimationFrame();

      document.body.classList.add("is-exporting-pdf");
      isExporting = true;
      await waitForFonts();
      await nextAnimationFrame();

      const pageElements = getExportPages();

      logPdfExport("pages found", { count: pageElements.length });

      if (pageElements.length === 0) {
        throw new Error(CAPTURE_ERROR_MESSAGE);
      }

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT],
        compress: true,
      });

      for (const [index, pageElement] of pageElements.entries()) {
        const canvas = await capturePhotobookPage(pageElement, html2canvas);
        const image = canvas.toDataURL("image/jpeg", 0.92);

        if (index > 0) {
          pdf.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT], "portrait");
        }

        pdf.addImage(image, "JPEG", 0, 0, PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT);
      }

      pdf.save(`clay-${slugify(roomName)}-photobook.pdf`);
      setStatus("idle");
    } catch (downloadError) {
      setStatus("error");
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "PDF generation failed.",
      );
    } finally {
      if (isExporting) {
        document.body.classList.remove("is-exporting-pdf");
      }
    }
  }

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-10 rounded-full"
        onClick={handleDownload}
        disabled={disabled || status === "loading"}
      >
        {status === "loading" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        {status === "loading" ? "Preparing PDF..." : "Download PDF"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
