"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

/**
 * The photo and video pickers. Originated in PostAdWizard.tsx (the create-listing flow),
 * extracted here so EditListingPhotos/VideoManager can match its look for the same add-media
 * interaction post-creation, rather than a smaller ad-hoc control that read as a different
 * feature.
 *
 * A dashed border reads as "drop or choose something here" rather than as a filled button
 * competing with other actions, and the full-width tap target matters more on a phone than the
 * few pixels it costs on desktop.
 *
 * Drag-and-drop needs no capability test. A phone fires no drag events, so the handlers simply
 * never run there — only the "or drag them here" hint is hidden below sm, since it would be
 * advice a touch user cannot follow. `onDragOver` must preventDefault or the browser navigates
 * to the dropped file instead of handing it over, which is the failure everyone hits first.
 */
export function UploadZone({
  accept,
  multiple = true,
  onFiles,
  icon,
  label,
  hint,
}: {
  accept: string;
  multiple?: boolean;
  onFiles: (files: FileList | null) => void;
  icon: IconName;
  label: string;
  hint: string;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFiles(e.dataTransfer.files);
      }}
      className={`flex flex-col items-center justify-center gap-1.5 w-full border-[1.5px] border-dashed rounded-xl px-4 py-6 cursor-pointer text-center transition-colors ${
        dragging ? "border-green bg-green/10" : "border-green bg-surface-alt"
      }`}
    >
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <span className="text-2xl leading-none text-green">
        <Icon name={icon} />
      </span>
      <span className="text-sm font-bold text-green">
        {dragging ? "Drop to add" : label}
      </span>
      <span className="text-xs text-muted">
        {hint}
        <span className="hidden sm:inline"> · or drag them here</span>
      </span>
    </label>
  );
}
