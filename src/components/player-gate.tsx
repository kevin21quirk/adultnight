"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Provider-verification gate for the embedded player.
 *
 * Pornhub serves "video unavailable" to embed requests from age-unverified
 * visitors in restricted jurisdictions (e.g. UK OSA). The user must complete
 * verification on the provider's own site first; the embed iframe is only
 * mounted after they confirm, so the request carries their provider session.
 *
 * Two detection layers drive the prompt:
 * - /api/embed-check probes the embed URL server-side with an anonymous
 *   session, telling us whether the provider gates unverified viewers at
 *   all (server egress region — not the user's own session).
 * - After the iframe mounts we read contentWindow.length, one of the few
 *   cross-origin-readable properties. The gate stub is a bare page with no
 *   subframes; the real player page has subframes. A 0 count means this
 *   user's embed was very likely blocked.
 *
 * The "verify" action is a plain top-level link to the provider's page —
 * real navigation that cannot be stopped by CORS, popup blockers or any
 * client-side restriction.
 */
export function PlayerGate({
  embedUrl,
  sourceUrl,
  providerName,
  providerSlug,
  providerVideoId,
  thumbnailUrl,
  title,
  isVr,
}: {
  embedUrl: string;
  sourceUrl: string | null;
  providerName: string;
  providerSlug: string;
  providerVideoId: string;
  thumbnailUrl: string | null;
  title: string;
  isVr?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [flat, setFlat] = useState(true); // flat mono is the sane desktop default
  const [anonGated, setAnonGated] = useState<boolean | null>(null);
  const [embedSuspect, setEmbedSuspect] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let dead = false;
    fetch(
      `/api/embed-check?provider=${encodeURIComponent(providerSlug)}&id=${encodeURIComponent(providerVideoId)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!dead) setAnonGated(d?.state === "gated");
      })
      .catch(() => {
        if (!dead) setAnonGated(false);
      });
    return () => {
      dead = true;
    };
  }, [providerSlug, providerVideoId]);

  function onIframeLoad() {
    const check = () => {
      try {
        if ((iframeRef.current?.contentWindow?.length ?? 0) === 0) {
          setEmbedSuspect(true);
        }
      } catch {
        // Cross-origin read denied — leave the hint off.
      }
    };
    setTimeout(check, 1500);
    setTimeout(check, 5000);
  }

  if (playing) {
    return (
      <div>
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title={title}
            onLoad={onIframeLoad}
            className="absolute inset-0 h-full w-full"
            style={
              flat && isVr
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
        {embedSuspect && sourceUrl && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-900 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
            <span>
              The {providerName} player reports this video as unavailable —
              your age verification on {providerName} probably hasn&rsquo;t
              gone through.
            </span>
            <a
              href={sourceUrl}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="shrink-0 rounded border border-amber-700 px-2.5 py-1 font-medium text-amber-100 hover:bg-amber-800/40"
            >
              Verify on {providerName} ↗
            </a>
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
          {anonGated
            ? `${providerName} requires age verification on its own site before its player can load here.`
            : `This video is hosted by ${providerName}. In the UK and some other regions, ${providerName} requires you to verify your age on their site before its player can load.`}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className={`rounded-md px-5 py-2.5 text-sm font-medium ${
                anonGated
                  ? "bg-accent-600 text-white hover:bg-accent-500"
                  : "border border-accent-500 text-accent-300 hover:bg-accent-600/20"
              }`}
            >
              1 · Verify on {providerName} ↗
            </a>
          )}
          <button
            onClick={() => setPlaying(true)}
            className={`rounded-md px-6 py-2.5 text-sm font-medium ${
              anonGated
                ? "border border-night-600 text-neutral-300 hover:border-neutral-400"
                : "bg-accent-600 hover:bg-accent-500"
            }`}
          >
            {anonGated ? "2 · I’ve verified — play video" : "2 · Play video"}
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
