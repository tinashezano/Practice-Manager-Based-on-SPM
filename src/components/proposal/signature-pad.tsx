"use client";

import { Eraser } from "lucide-react";
import { useEffect, useRef } from "react";

/** Draw a signature with a mouse, finger or stylus. Reports a PNG data URL (or null when cleared). */
export function SignaturePad({ onChange, height = 110, label = "Sign here" }: { onChange: (png: string | null) => void; height?: number; label?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = canvas.current!;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    c.width = c.offsetWidth * ratio;
    c.height = height * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, [height]);

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const ctx = canvas.current!.getContext("2d")!;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    dirty.current = true;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (dirty.current) onChange(canvas.current!.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    dirty.current = false;
    onChange(null);
  };

  return (
    <div className="relative">
      <canvas
        ref={canvas}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        style={{ height, touchAction: "none" }}
        className="block w-full cursor-crosshair rounded-lg border border-dashed border-[#94a3b8] bg-[#fafbfc]"
        aria-label={label}
      />
      <span className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-[#9ca3af]">{label}</span>
      <button type="button" onClick={clear} className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[11px] text-[#4b5563] shadow-sm hover:text-[#dc2626]">
        <Eraser size={12} /> Clear
      </button>
    </div>
  );
}
