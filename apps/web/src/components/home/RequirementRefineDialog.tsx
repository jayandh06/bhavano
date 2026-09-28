"use client";

import { useEffect, useState } from "react";
import type { RequirementAnswers, RequirementDto } from "@bhavano/types";
import { RequirementRefineWizard, type RequirementWizardSubject } from "./RequirementRefineWizard";

/** The requirement questions as a modal over the page the search failed on — a bottom sheet on a
 * phone, a centred card on a tablet or desktop. Nothing is saved until the last step creates the
 * requirement, so Escape and the backdrop simply close it. */
export function RequirementRefineDialog({
  requirement,
  create,
  onFinished,
  onClose,
}: {
  requirement: RequirementWizardSubject;
  create: (answers: RequirementAnswers) => Promise<RequirementDto>;
  onFinished: (requirement: RequirementDto) => void;
  onClose: () => void;
}) {
  /** The visible part of the page. Mobile browsers — iOS Safari above all — lay the on-screen
   * keyboard over a fixed overlay instead of shrinking it, which would leave the bottom sheet and
   * whatever field is being typed into behind the keyboard. Pinning the overlay to the visual
   * viewport keeps the sheet sitting on top of the keyboard. */
  const [viewport, setViewport] = useState<{ top: number; height: number } | null>(() => {
    const vv = typeof window === "undefined" ? null : window.visualViewport;
    return vv ? { top: vv.offsetTop, height: vv.height } : null;
  });

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setViewport({ top: vv.offsetTop, height: vv.height });
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className={`fixed inset-x-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-6 ${
        viewport ? "" : "inset-y-0"
      }`}
      style={viewport ? { top: viewport.top, height: viewport.height } : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tell us more about what you need"
        className="w-full sm:max-w-[640px] lg:max-w-[720px] max-h-[92%] sm:max-h-full overflow-y-auto overscroll-contain bg-surface text-text text-left font-normal rounded-t-2xl sm:rounded-2xl px-5 pt-5 pb-1 sm:px-7 sm:pt-7 shadow-xl"
      >
        <RequirementRefineWizard
          requirement={requirement}
          mode={{ kind: "create", create }}
          onFinished={onFinished}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
