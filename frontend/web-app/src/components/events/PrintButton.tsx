"use client";

import { Button } from "@/components/ui/Button";

/** Uses the browser's native print dialog ("save as PDF") — the ticket page's own <title> (set via generateMetadata) becomes the suggested file name, so it's the event's name rather than a GUID. */
export function PrintButton() {
  return (
    <Button className="mt-6 w-full print:hidden" onClick={() => window.print()}>
      הדפסה / שמירה כ-PDF
    </Button>
  );
}
