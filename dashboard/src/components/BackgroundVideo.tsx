"use client";

import { useEffect, useRef } from "react";

/**
 * React doesn't reliably emit the `muted` attribute in the initial HTML for
 * <video> (a long-standing React/DOM quirk — it sets the JS property, not
 * the attribute), and Safari's autoplay policy checks the attribute at parse
 * time. Result: the video silently renders as a static first frame instead
 * of playing. Setting `.muted` imperatively via a ref before calling
 * `.play()` sidesteps this.
 *
 * Belt-and-suspenders: some contexts (Low Power Mode, certain installed-PWA
 * standalone webviews) block autoplay outright regardless of `muted`. A
 * one-time listener retries `.play()` on the very first tap anywhere in the
 * app, which reliably unlocks media playback per the platform's user-gesture
 * rules.
 */
export function BackgroundVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    video.muted = true;
    video.play().catch(() => {
      // Expected when autoplay is blocked — the tap listener below retries.
    });

    function retryOnFirstInteraction() {
      video?.play().catch(() => {});
      window.removeEventListener("touchstart", retryOnFirstInteraction);
      window.removeEventListener("click", retryOnFirstInteraction);
    }

    window.addEventListener("touchstart", retryOnFirstInteraction, { once: true, passive: true });
    window.addEventListener("click", retryOnFirstInteraction, { once: true });

    return () => {
      window.removeEventListener("touchstart", retryOnFirstInteraction);
      window.removeEventListener("click", retryOnFirstInteraction);
    };
  }, []);

  return (
    <video
      ref={ref}
      className="app-background-video"
      src="/background.mp4"
      muted
      loop
      playsInline
      autoPlay
      aria-hidden="true"
    />
  );
}
