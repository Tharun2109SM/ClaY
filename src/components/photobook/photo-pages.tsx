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
    <section className="grid gap-6 rounded-[2rem] border border-border/35 bg-card/35 p-5 shadow-[0_18px_60px_rgb(0_0_0_/_0.04)] dark:border-white/[0.07] dark:bg-white/[0.02] dark:shadow-[0_20px_70px_rgb(0_0_0_/_0.24)]">
      <div>
        <p className="text-[0.68rem] uppercase tracking-[0.24em] text-muted-foreground/75">
          Generated pages
        </p>
        <h2 className="mt-2 text-2xl font-light">Photo story</h2>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {pages.map((pagePhotos, pageIndex) => (
          <div
            key={pagePhotos.map((photo) => photo.id).join("-")}
            data-photobook-page="true"
            data-photobook-page-label={`photo page ${pageIndex + 1}`}
            className="aspect-[4/5] min-h-0 overflow-hidden rounded-[1.35rem] border border-black/[0.10] bg-card p-3 shadow-[0_18px_52px_rgb(0_0_0_/_0.10)] dark:border-white/[0.10] dark:shadow-[0_22px_70px_rgb(0_0_0_/_0.42)]"
          >
            <div className={`grid size-full gap-3 ${layoutClass(pagePhotos.length)}`}>
              {pagePhotos.map((photo) => (
                <div key={photo.id} className="relative overflow-hidden rounded-2xl bg-muted">
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
