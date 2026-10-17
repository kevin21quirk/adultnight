"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Interactive 360°/180° WebGL video player.
 *
 * Renders an authorized video file URL on the inside of a sphere via
 * three.js — drag with the mouse (or touch) to look around. Supports:
 *   - "mono360": equirectangular 360° monoscopic
 *   - "sbs180" / "sbs360": side-by-side stereoscopic (left eye shown,
 *     mapped so the desktop view is a normal mono frame)
 *
 * IMPORTANT: `src` must be a URL you are authorized to play directly
 * (e.g. an affiliate feed media URL or your own hosted file). Provider
 * embed pages never expose file URLs — do not point this at scraped or
 * hotlinked streams. Cross-origin sources need CORS headers; if the
 * source lacks them, route through a same-origin proxy.
 */
export function VrSpherePlayer({
  src,
  mode = "mono360",
  title,
}: {
  src: string;
  mode?: "mono360" | "sbs180" | "sbs360";
  title: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const togglePlayRef = useRef<() => void>(() => {});
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const THREE = await import("three");
      const mount = mountRef.current;
      const video = videoRef.current;
      if (!mount || !video || cancelled) return;

      video.crossOrigin = "anonymous";
      video.playsInline = true;
      video.loop = true;
      video.muted = true; // autoplay-safe; unmute on play click below

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 100);

      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      if (mode !== "mono360") {
        // Show only the left half of the SBS frame across the sphere.
        texture.repeat.set(0.5, 1);
        texture.offset.set(0, 0);
      }

      const geometry = new THREE.SphereGeometry(50, 64, 40);
      geometry.scale(-1, 1, 1); // view from inside
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ map: texture })
      );
      scene.add(mesh);

      // Manual drag-look controls.
      let lon = 0;
      let lat = 0;
      let dragging = false;
      let movedPx = 0;
      let px = 0;
      let py = 0;
      const el = renderer.domElement;

      const down = (x: number, y: number) => {
        dragging = true;
        movedPx = 0;
        px = x;
        py = y;
      };
      const move = (x: number, y: number) => {
        if (!dragging) return;
        movedPx += Math.abs(px - x) + Math.abs(py - y);
        lon += (px - x) * 0.15;
        lat -= (py - y) * 0.15;
        lat = Math.max(-85, Math.min(85, lat));
        px = x;
        py = y;
      };
      const up = () => (dragging = false);
      // Click toggles play/pause — but not when it ended a drag.
      const onClick = () => {
        if (movedPx < 6) togglePlayRef.current?.();
      };

      const onMouseDown = (e: MouseEvent) => down(e.clientX, e.clientY);
      const onMouseMove = (e: MouseEvent) => move(e.clientX, e.clientY);
      const onTouchStart = (e: TouchEvent) =>
        down(e.touches[0].clientX, e.touches[0].clientY);
      const onTouchMove = (e: TouchEvent) =>
        move(e.touches[0].clientX, e.touches[0].clientY);

      el.addEventListener("mousedown", onMouseDown);
      el.addEventListener("click", onClick);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", up);
      el.addEventListener("touchstart", onTouchStart, { passive: true });
      el.addEventListener("touchmove", onTouchMove, { passive: true });
      window.addEventListener("touchend", up);

      const resize = () => {
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(mount);

      const phi = () => THREE.MathUtils.degToRad(90 - lat);
      const theta = () => THREE.MathUtils.degToRad(lon);
      const target = new THREE.Vector3();
      let raf = 0;
      const tick = () => {
        target.set(
          500 * Math.sin(phi()) * Math.cos(theta()),
          500 * Math.cos(phi()),
          500 * Math.sin(phi()) * Math.sin(theta())
        );
        camera.lookAt(target);
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      tick();

      const onErr = () =>
        setError(
          "Video failed to load — the source may block cross-origin playback. A same-origin proxy would be needed."
        );
      video.addEventListener("error", onErr);

      dispose = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        el.removeEventListener("mousedown", onMouseDown);
        el.removeEventListener("click", onClick);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", up);
        el.removeEventListener("touchstart", onTouchStart);
        el.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", up);
        video.removeEventListener("error", onErr);
        texture.dispose();
        geometry.dispose();
        (mesh.material as import("three").Material).dispose();
        renderer.dispose();
        mount.removeChild(el);
      };
    })();

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [src, mode]);

  togglePlayRef.current = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.muted = false;
      void v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  return (
    <div>
      <div
        ref={mountRef}
        className="relative aspect-video w-full overflow-hidden rounded-lg bg-black cursor-grab active:cursor-grabbing"
      >
        <video ref={videoRef} src={src} className="hidden" />
        {!playing && (
          <button
            onClick={() => togglePlayRef.current?.()}
            className="absolute inset-0 flex items-center justify-center bg-black/40 text-white"
          >
            <span className="rounded-full bg-accent-600 px-6 py-3 font-medium">
              ▶ Play 360°
            </span>
          </button>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-night-900 px-6 text-center text-sm text-red-300">
            {error}
          </div>
        )}
        <p className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-[11px] text-neutral-300">
          Drag to look around
        </p>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        {title} — interactive {mode === "mono360" ? "360°" : "180° stereo"}.
        Click the player to pause.
      </p>
    </div>
  );
}
