"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function BarcodeScanner({
  onScanSuccess,
  onScanFailure,
  onClose,
}: {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure?: (error: string) => void;
  onClose: () => void;
}) {
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = "barcode-scanner-reader";

  useEffect(() => {
    // Initialize html5 qrcode
    const html5Qrcode = new Html5Qrcode(regionId);
    scannerRef.current = html5Qrcode;

    // Start scanner
    html5Qrcode
      .start(
        { facingMode: "environment" }, // back camera on mobile/iPad
        {
          fps: 10,
          qrbox: (width, height) => {
            // Rectangular area suitable for standard linear barcodes
            const boxWidth = Math.min(width * 0.85, 300);
            const boxHeight = Math.min(height * 0.4, 120);
            return { width: boxWidth, height: boxHeight };
          },
          aspectRatio: 1.777778, // 16:9 aspect ratio feed
        },
        (decodedText) => {
          onScanSuccess(decodedText);
          html5Qrcode.stop().catch(console.error);
        },
        (errorMessage) => {
          if (onScanFailure) onScanFailure(errorMessage);
        }
      )
      .then(() => {
        setCameraPermission(true);
      })
      .catch((err) => {
        console.error("Camera access/startup error:", err);
        setCameraPermission(false);
        setErrorMsg(err?.message || "Could not access back camera.");
      });

    return () => {
      if (html5Qrcode && html5Qrcode.isScanning) {
        html5Qrcode.stop().catch(console.error);
      }
    };
  }, [onScanSuccess, onScanFailure]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 border border-gray-200 shadow-2xl relative flex flex-col gap-4 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-rose-500">barcode_scanner</span>
            Scan Barcode
          </h3>
          <button
            onClick={onClose}
            aria-label="Close barcode scanner"
            className="text-gray-400 hover:text-gray-700 p-1.5 hover:bg-gray-50 rounded-xl transition-all"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Camera Container */}
        <div className="relative aspect-video w-full bg-gray-950 rounded-2xl overflow-hidden border border-gray-200 flex items-center justify-center">
          <div id={regionId} className="w-full h-full object-cover" />

          {/* Aiming Reticle overlay */}
          {cameraPermission && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-[80%] h-[110px] border-2 border-rose-500 rounded-xl bg-rose-500/5 flex items-center justify-center relative">
                {/* Scanline element */}
                <div className="absolute inset-x-3 h-0.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-pulse" />
              </div>
            </div>
          )}

          {cameraPermission === false && (
            <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center bg-red-50 text-red-700">
              <span className="material-symbols-outlined text-3xl text-red-500 mb-2">videocam_off</span>
              <p className="text-xs font-semibold">Camera Access Denied</p>
              <p className="text-[10px] text-red-500 mt-1 max-w-[260px]">{errorMsg}</p>
            </div>
          )}

          {cameraPermission === null && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-900">
              <span className="animate-spin border-2 border-rose-500 border-t-transparent w-6 h-6 rounded-full mb-2" />
              <p className="text-xs">Requesting camera access...</p>
            </div>
          )}
        </div>

        <p className="text-[11px] text-gray-500 text-center leading-relaxed">
          Position the product barcode within the red scanner boundary. Camera authorization is required.
        </p>
      </div>
    </div>
  );
}
