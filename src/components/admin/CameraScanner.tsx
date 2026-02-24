"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { CameraOff, Loader2 } from "lucide-react";

interface CameraScannerProps {
  /** Called with the raw decoded QR string once per scan (2-second cooldown). */
  onScan: (value: string) => void;
}

export default function CameraScanner({ onScan }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<number>(0);  // 2-second cooldown after a successful scan
  const lastFrameRef = useRef<number>(0); // throttle frame processing to ~10 fps

  const [status, setStatus] = useState<"loading" | "active" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("active");
        scanFrame();
      } catch (err: any) {
        if (!cancelled) {
          setStatus("error");
          if (err?.name === "NotAllowedError") {
            setErrorMsg("Camera permission denied. Please allow camera access and try again.");
          } else if (err?.name === "NotFoundError") {
            setErrorMsg("No camera found on this device.");
          } else {
            setErrorMsg("Unable to access camera: " + (err?.message ?? "Unknown error"));
          }
        }
      }
    }

    function scanFrame() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      // Throttle to ~10 fps — skip jsQR processing on intermediate frames.
      // Video continues rendering at native refresh rate; only decoding is capped.
      const now = Date.now();
      if (now - lastFrameRef.current < 100) {
        rafRef.current = requestAnimationFrame(scanFrame);
        return;
      }
      lastFrameRef.current = now;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        rafRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && now - lastScanRef.current > 2000) {
        lastScanRef.current = now;
        onScan(code.data);
      }

      rafRef.current = requestAnimationFrame(scanFrame);
    }

    startCamera();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [onScan]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
      {/* Video feed */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        muted
        playsInline
      />

      {/* Hidden canvas for frame processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Loading overlay */}
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-2">
          <Loader2 className="animate-spin text-white" size={32} />
          <p className="text-white text-sm">Starting camera…</p>
        </div>
      )}

      {/* Error overlay */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3 px-6 text-center">
          <CameraOff className="text-red-400" size={36} />
          <p className="text-white text-sm">{errorMsg}</p>
        </div>
      )}

      {/* Targeting reticle — only shown when active */}
      {status === "active" && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-48 h-48 relative">
            {/* Four corner brackets */}
            <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
            <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
            <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
            <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />

            {/* Scanning line animation */}
            <span className="absolute left-2 right-2 h-0.5 bg-primary/70 animate-scan-line" />
          </div>
          <p className="absolute bottom-4 text-white/70 text-xs tracking-wide">Point at the user&apos;s QR code</p>
        </div>
      )}
    </div>
  );
}
