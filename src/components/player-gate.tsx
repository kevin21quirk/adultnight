"use client";

import { useState } from "react";

/**
 * Provider-verification gate for the embedded player.
 *
 * Pornhub serves "video unavailable" to embed requests from age-unverified
 * visitors in restricted jurisdictions (e.g. UK OSA). The user must complete
 * verification on the provider's own site first; the embed iframe is only
 * mounted after they confirm, so the request carries their provider session.
 */
export function PlayerGate({
  embedUrl,
  sourceUrl,
  providerName,
  thumbnailUrl,
  title,
  isVr,
}: {
  embedUrl: string;
  sourceUrl: string | null;
  providerName: string;
  thumbnailUrl: string | null;
  title: string;
  isVr?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [flat, setFlat] = useState(true); // flat mono is the sane desktop default

  if (playing) {
    return (
      <div>
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
          <iframe
            src={embedUrl}
            title={title}
            className="absolute inset-0 h-full w-full"
            style={
              flat
                ? {
                    // VR source is side-by-side stereo; zooming to the left
                    // half shows one eye as a flat desktop view.
                    width: "200%",
                    height: "200%",
                    transform: "translate(0, -25%)",
                  }
                : undefined
            }
            frameBorder={0}
            allowFullScreen
            referrerPolicy="origin"
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        </div>
        {isVr && (
          <div className="mt-2 flex items-center gap-3 text-xs text-neutral-400">
            <span className="font-medium">VR view:</span>
            <button
              onClick={() => setFlat(false)}
              className={`rounded px-2.5 py-1 border ${!flat ? "border-accent-500 text-white" : "border-night-600 text-neutral-400"}`}
            >
              Side-by-side (headset)
            </button>
            <button
              onClick={() => setFlat(true)}
              className={`rounded px-2.5 py-1 border ${flat ? "border-accent-500 text-white" : "border-night-600 text-neutral-400"}`}
            >
              Flat (desktop)
            </button>
            <span className="text-neutral-600">
              Full 3D requires a headset on the provider site.
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-night-700 bg-night-800">
      {thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/thumb?u=${encodeURIComponent(thumbnailUrl)}`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="max-w-md text-sm text-neutral-300">
          This video is hosted by {providerName}. In the UK and some other
          regions, {providerName} requires you to verify your age on their
          site before its player can load.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="rounded-md border border-accent-500 px-5 py-2.5 text-sm font-medium text-accent-300 hover:bg-accent-600/20"
            >
              1 · Verify on {providerName} ↗
            </a>
          )}
          <button
            onClick={() => setPlaying(true)}
            className="rounded-md bg-accent-600 px-6 py-2.5 text-sm font-medium hover:bg-accent-500"
          >
            2 · Play video
          </button>
        </div>
        <p className="max-w-md text-xs text-neutral-500">
          If the player still shows as unavailable after verifying, your
          browser may be blocking third-party cookies — open the video on{" "}
          {providerName} directly instead.
        </p>
      </div>
    </div>
  );
}
