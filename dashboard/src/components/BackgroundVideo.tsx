"use client";

import { useEffect, useRef } from "react";

/**
 * React doesn't reliably emit the `muted` attribute in the initial HTML for
 * <video> (a long-standing React/DOM quirk — it sets the JS property, not
 * the attribute), and Safari's autoplay policy checks the attribute at parse
 * time. Result: the video silently renders as a static first frame instead
 * of playing. Setting `.muted` imperatively via a ref before calling
 * `.play()` sidesteps this.
 */
export function BackgroundVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = true;
    video.play().catch(() => {
      // Autoplay can still be blocked by the platform (e.g. low-power mode)
      // — the static first frame is an acceptable fallback in that case.
    });
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
