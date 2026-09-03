"use client";

import { useRef, useState, useTransition } from "react";
import { changeOwnAvatar, removeOwnAvatar } from "./actions";

const SIZE = 256;
const ACCEPT = "image/png,image/jpeg,image/webp";

/**
 * Reads a picked file, centre-crops it to a square and re-encodes it at
 * 256x256. Doing this in the browser means a 4MB phone photo never crosses the
 * wire, and what reaches the database is a predictable few tens of kilobytes
 * regardless of what was chosen.
 */
function toSquareDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas is unavailable."));

      const edge = Math.min(image.width, image.height);
      ctx.drawImage(
        image,
        (image.width - edge) / 2,
        (image.height - edge) / 2,
        edge,
        edge,
        0,
        0,
        SIZE,
        SIZE,
      );

      // WebP where it exists, JPEG everywhere else. toDataURL falls back to
      // PNG for an unsupported type, which would be several times larger, so
      // the result is checked rather than assumed.
      const webp = canvas.toDataURL("image/webp", 0.85);
      resolve(
        webp.startsWith("data:image/webp")
          ? webp
          : canvas.toDataURL("image/jpeg", 0.85),
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("That file could not be read as an image."));
    };

    image.src = objectUrl;
  });
}

export function AvatarUpload({
  image,
  initial,
}: {
  image: string | null;
  initial: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Shown immediately after cropping so the new picture appears without
  // waiting for the round trip.
  const [preview, setPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const shown = preview ?? image;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);

    let dataUrl: string;
    try {
      dataUrl = await toSquareDataUrl(file);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read that file.");
      return;
    }

    setPreview(dataUrl);
    startTransition(async () => {
      const result = await changeOwnAvatar(dataUrl);
      if (!result.ok) {
        setPreview(null);
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex items-center gap-4">
      <span
        aria-hidden
        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-visible bg-white/[0.03] text-[17px] font-medium text-tertiary"
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              // Clear it, so picking the same file twice still fires.
              e.target.value = "";
            }}
          />

          <button
            type="button"
            disabled={isPending}
            onClick={() => inputRef.current?.click()}
            className="ease-base flex h-8 items-center rounded-control border border-border-visible bg-white/[0.035] px-3 text-[12.5px] font-medium text-primary transition-[background-color,transform] duration-150 hover:bg-white/[0.065] active:translate-y-[1px] disabled:pointer-events-none disabled:opacity-60"
          >
            {isPending ? "Uploading…" : shown ? "Change picture" : "Upload picture"}
          </button>

          {shown && !isPending && (
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  setPreview(null);
                  const result = await removeOwnAvatar();
                  if (!result.ok) setError(result.error);
                })
              }
              className="ease-base h-8 rounded-control px-2 text-[12.5px] text-muted transition-colors duration-200 hover:text-secondary"
            >
              Remove
            </button>
          )}
        </div>

        <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
          PNG, JPEG or WebP. Cropped to a square and resized to 256px before it
          is saved.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="text-[12.5px] leading-relaxed text-secondary"
        >
          {error}
        </p>
      )}
    </div>
  );
}
