"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/** Canvas/WebGL — must never run during SSR. */
const GemSmoke = dynamic(() => import("@paper-design/shaders-react").then((mod) => mod.GemSmoke), {
  ssr: false,
});

/** Replaces the desktop shell's old CSS-orb ambient background with a live
 * shader, tinted to Cortège's mint/gold identity. Skips rendering entirely
 * under prefers-reduced-motion rather than trying to freeze a single frame —
 * there's no static fallback worth showing for a shader like this. */
export function GemSmokeBackground() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const listener = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return (
    <div className="desktop-ambient" aria-hidden="true">
      {!reducedMotion && (
        <GemSmoke
          style={{ width: "100%", height: "100%" }}
          colors={["#34d399", "#d9b872"]}
          colorBack="#0b0d12"
          colorInner="#12151c"
          shape="none"
          innerDistortion={0.5}
          outerDistortion={0.4}
          outerGlow={0.35}
          innerGlow={0.5}
          offset={0}
          angle={0}
          size={0.9}
          speed={0.35}
          scale={1.4}
        />
      )}
    </div>
  );
}
