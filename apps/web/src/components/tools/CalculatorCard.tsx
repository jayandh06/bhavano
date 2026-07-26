"use client";

import type { ReactNode } from "react";

/** Shared shell for every calculator's inputs + live result — a bordered panel with the inputs
 * on top and, once there's a result to show, a highlighted result row underneath. */
export function CalculatorCard({
  children,
  resultLabel,
  resultValue,
}: {
  children: ReactNode;
  resultLabel?: string;
  resultValue?: ReactNode;
}) {
  return (
    <div className="border border-border rounded-2xl bg-surface p-5 flex flex-col gap-3.5 max-w-[560px]">
      <div className="flex flex-col gap-3.5">{children}</div>
      {resultValue !== undefined && resultValue !== null && (
        <div className="border-t border-border pt-3.5 mt-1">
          {resultLabel && <div className="text-[13px] font-bold text-text-soft mb-1">{resultLabel}</div>}
          <div className="font-lora text-2xl font-bold text-green">{resultValue}</div>
        </div>
      )}
    </div>
  );
}
