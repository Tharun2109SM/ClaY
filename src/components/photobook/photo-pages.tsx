import Image from "next/image";
import type { PhotoAsset } from "@/lib/types";

const layouts = ["single", "split", "trio", "grid"] as const;

function chunkPhotos(photos: PhotoAsset[]) {
  const pages: PhotoAsset[][] = [];
  let index = 0;

  while (index < photos.length) {
    const size = Math.min((index % 4) + 1, photos.length - index);
    pages.push(photos.slice(index, index + size));
    index += size;
  }

  return pages;
}

function layoutClass(count: number) {
  if (count === 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-2";
  return "grid-cols-2";
}

export function PhotoPages({ photos }: { photos: PhotoAsset[] }) {
  const pages = chunkPhotos(photos);

  if (pages.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Generated pages</p>
        <h2 className="mt-1 text-2xl font-semibold">Photo story</h2>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {pages.map((pagePhotos, pageIndex) => (
          <div
            key={pagePhotos.map((photo) => photo.id).join("-")}
            data-photobook-page="true"
            data-photobook-page-label={`photo page ${pageIndex + 1}`}
            className="aspect-[4/5] min-h-0 overflow-hidden rounded-lg border border-black/[0.10] bg-card p-3 shadow-[0_12px_36px_rgb(0_0_0_/_0.08)] dark:border-white/[0.10] dark:shadow-[0_16px_46px_rgb(0_0_0_/_0.32)]"
          >
            <div className={`grid size-full gap-3 ${layoutClass(pagePhotos.length)}`}>
              {pagePhotos.map((photo) => (
                <div key={photo.id} className="relative overflow-hidden rounded-md bg-muted">
                  {photo.thumbnail_public_url ? (
                    <Image
                      src={photo.thumbnail_public_url}
                      alt={photo.original_file_name}
                      fill
                      sizes="(min-width: 768px) 260px, 45vw"
                      className="object-cover"
                      crossOrigin="anonymous"
                      loading="eager"
                      unoptimized
                    />
                  ) : null}
                  {photo.caption ? (
                    <div className="absolute inset-x-0 bottom-0 bg-black/45 px-3 py-2 text-xs leading-5 text-white backdrop-blur-sm">
                      {photo.caption}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Page {pageIndex + 3} · {layouts[(pagePhotos.length - 1) % layouts.length]}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
