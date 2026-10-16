"use client";

import { useState } from "react";

/**
 * Thumbnail with graceful fallback — provider CDN URLs (signed phncdn
 * links especially) expire over time. A failed load swaps to the same
 * "No preview" placeholder used when no thumb exists.
 */
export function ThumbImage({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="h-full w-full flex items-center justify-center text-neutral-600 text-xs">
        No preview
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
