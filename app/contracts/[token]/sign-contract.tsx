"use client";

import { useRef, useState } from "react";

export default function SignContract({ token, customerName }: { token: string; customerName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [signed, setSigned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [mode, setMode] = useState<"draw" | "type">("draw");

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDrawing(true);
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function handleSign() {
    setLoading(true);
    const signatureData = mode === "draw" ? canvasRef.current?.toDataURL() : `TYPED:${typedName}`;

    try {
      const res = await fetch(`/api/contracts/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, signature_data: signatureData }),
      });
      if (res.ok) setSigned(true);
    } catch {
      alert("Failed to sign");
    } finally {
      setLoading(false);
    }
  }

  if (signed) {
    return (
      <div className="bg-green-50 rounded-2xl border border-green-200 p-8 text-center">
        <span className="material-symbols-outlined text-4xl text-green-600 mb-3 block">check_circle</span>
        <h3 className="text-lg font-bold text-gray-900">Contract Signed!</h3>
        <p className="text-sm text-gray-500 mt-1">Thank you, {customerName}. You&apos;ll receive a confirmation email.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Sign Below</h3>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setMode("draw")} className={`px-4 py-2 rounded-xl text-sm font-medium ${mode === "draw" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>Draw</button>
        <button onClick={() => setMode("type")} className={`px-4 py-2 rounded-xl text-sm font-medium ${mode === "type" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>Type</button>
      </div>

      {mode === "draw" ? (
        <div>
          <canvas
            ref={canvasRef}
            width={560}
            height={150}
            className="w-full border border-gray-300 rounded-xl cursor-crosshair bg-white touch-none"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={() => setDrawing(false)}
            onMouseLeave={() => setDrawing(false)}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={() => setDrawing(false)}
          />
          <button onClick={clear} className="text-xs text-gray-500 hover:text-gray-900 mt-2">Clear</button>
        </div>
      ) : (
        <div>
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Type your full name"
            className="w-full px-4 py-4 rounded-xl border border-gray-300 text-2xl outline-none"
            style={{ fontFamily: "cursive" }}
          />
        </div>
      )}

      <div className="flex items-center gap-3 mt-4">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" required className="rounded" />
          I agree to the terms above
        </label>
      </div>

      <button
        onClick={handleSign}
        disabled={loading || (mode === "type" && !typedName.trim())}
        className="w-full mt-4 py-3 bg-rose-600 text-white rounded-xl text-base font-medium hover:bg-rose-700 transition-colors disabled:opacity-50"
      >
        {loading ? "Signing..." : "Sign Contract"}
      </button>
    </div>
  );
}
