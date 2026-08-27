"use client";

export function PrintButton({ label = "Save as PDF" }: { label?: string }) {
  return (
    <button className="btn btn-outline btn-sm pd-noprint" type="button" onClick={() => window.print()}>
      {label}
    </button>
  );
}
