import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyGallery() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
        <div className="grid size-14 place-items-center rounded-full bg-accent text-accent-foreground">
          <ImagePlus className="size-6" />
        </div>
        <div className="max-w-sm">
          <h2 className="text-lg font-semibold">No photos yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No memories here yet. Upload the first few photos to begin shaping
            this room.
          </p>
        </div>
        <Button disabled variant="outline">
          Waiting for photos
        </Button>
      </CardContent>
    </Card>
  );
}
