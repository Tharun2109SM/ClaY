import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyGallery() {
  return (
    <Card className="rounded-[2rem] border-dashed border-foreground/14 bg-card/52 shadow-[0_18px_70px_rgb(0_0_0_/_0.10)] dark:bg-white/[0.025]">
      <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
        <div className="grid size-14 place-items-center rounded-full border border-foreground/10 bg-[#f7efe0] text-black shadow-sm dark:bg-white/10 dark:text-foreground">
          <ImagePlus className="size-6" />
        </div>
        <div className="max-w-sm">
          <h2 className="text-xl">No photos yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No memories here yet. Upload the first few photos to begin shaping
            this room.
          </p>
        </div>
        <Button disabled variant="outline" className="rounded-full">
          Waiting for photos
        </Button>
      </CardContent>
    </Card>
  );
}
