"use client";

import { Printer } from "lucide-react";
import { useEffect } from "react";

export function PreviewBar({ autoPrint }: { autoPrint: boolean }) {
  useEffect(() => {
    if (!autoPrint) return;
    // Let fonts and the logo load before opening the print dialog.
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [autoPrint]);
  return (
    <div className="mx-auto mb-4 flex max-w-[760px] items-center justify-between px-4 print:hidden">
      <p className="text-sm text-[#4b4f6a]">Preview: this is what the client sees.</p>
      <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm shadow-sm hover:bg-[#f6f6f9]">
        <Printer size={15} /> Download PDF
      </button>
    </div>
  );
}
