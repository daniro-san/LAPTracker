"use client";

// The button of "Send screenshots" and its hidden file input (issue 299), moved out of SendScreenshots.tsx
// for its size. A tab's button can start its pictures as a type (D110).
import { useRef, useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { chip } from "@/lib/brand/components/controls";
import type { ImportKind } from "@/lib/private/import-kinds";

/** A type a tab's button starts its pictures as (D110). */
export interface Preset {
  kind: ImportKind;
  label: string;
}

/**
 * "Send screenshots": a 44 px button that opens the phone's picker, several pictures at once. With two
 * presets (Members), the button first shows them, and each opens the picker with its type.
 */
export function FilePicker(props: {
  label: string | undefined;
  busy: boolean;
  presets: Preset[];
  ask: string | undefined;
  onFiles: (f: File[], preset: Preset | undefined) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const chosen = useRef<Preset | undefined>(props.presets[0]);
  const [open, setOpen] = useState(false);
  const pick = (preset: Preset | undefined) => {
    chosen.current = preset;
    input.current?.click();
  };
  const several = props.presets.length > 1;
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const files = [...(e.currentTarget.files ?? [])];
          e.currentTarget.value = "";
          if (files.length > 0) props.onFiles(files, chosen.current);
        }}
      />
      <button
        type="button"
        disabled={props.busy}
        aria-expanded={several ? open : undefined}
        onClick={() => (several ? setOpen(!open) : pick(props.presets[0]))}
        className={
          // Home's door is the main action; a tab's sits beside the tab's own work (D110).
          props.presets.length > 0
            ? buttonClass("secondary")
            : "ink-button inline-flex min-h-11 w-full items-center justify-center px-4 font-medium disabled:opacity-50 sm:w-auto"
        }
      >
        {props.label}
      </button>
      {several && open && (
        <div className="mt-2 border border-rule px-3 py-2">
          <p className="text-body-sm font-semibold">{props.ask}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {props.presets.map((p) => (
              <button
                key={p.kind}
                type="button"
                disabled={props.busy}
                onClick={() => pick(p)}
                className={chip()}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
