"use client";

import { useFormStatus } from "react-dom";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UploadSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-fit">
      <UploadCloud className="size-4" />
      {pending ? "Uploading..." : "Upload photos"}
    </Button>
  );
}
