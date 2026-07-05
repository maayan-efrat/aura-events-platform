"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/**
 * Reads QR codes from the device camera (laptop webcam included — no phone required):
 * grabs video frames onto a hidden canvas and runs jsQR against each one. Calls onScan once per
 * newly-seen code (dedup via lastCodeRef) so holding the ticket steady doesn't fire repeatedly.
 */
export function QrScanner({ onScan }: { onScan: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastCodeRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frameId: number;
    let stopped = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch {
        setError("לא ניתן היה לגשת למצלמה. ודאו שאישרתם הרשאת מצלמה לדפדפן.");
        return;
      }
      if (stopped || !videoRef.current) return;

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      frameId = requestAnimationFrame(tick);
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        if (context) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data && code.data !== lastCodeRef.current) {
            lastCodeRef.current = code.data;
            onScan(code.data);
            // Allow re-scanning the same ticket later (e.g. a retry after a failed check-in)
            // instead of permanently ignoring it for the rest of this session.
            setTimeout(() => {
              if (lastCodeRef.current === code.data) lastCodeRef.current = null;
            }, 3000);
          }
        }
      }
      frameId = requestAnimationFrame(tick);
    }

    start();

    return () => {
      stopped = true;
      cancelAnimationFrame(frameId);
      stream?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onScan is expected to be stable enough per mount
  }, []);

  if (error) {
    return <p className="text-sm text-error">{error}</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-black">
      <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
