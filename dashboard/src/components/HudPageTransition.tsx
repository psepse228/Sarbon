"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { HUD_SPACE_ORDER } from "@/components/SpaceIndicator";

function spaceIndex(pathname: string): number {
  // Longest-prefix match, not first match -- "/d/leads" must not be caught
  // by a hypothetical shorter "/d" entry ahead of it in the list.
  let best = -1;
  let bestLen = -1;
  HUD_SPACE_ORDER.forEach((href, i) => {
    const matches = href === "/d" ? pathname === "/d" : pathname.startsWith(href);
    if (matches && href.length > bestLen) {
      best = i;
      bestLen = href.length;
    }
  });
  return best;
}

/** Plain-route equivalent of Argus's HUD-spaces slide -- Cortège's desktop
 * dashboard keeps real routes/URLs (unlike Argus's single-page state), so
 * there's no shared sliding container to animate. Instead this replays a
 * short directional entrance animation on the page content every time the
 * route changes, keyed by pathname so React actually remounts the wrapper
 * and the CSS animation restarts (see .hud-page-transition in globals.css).
 * Query-string-only changes (e.g. conversations' ?conversationId=) don't
 * retrigger it, since usePathname() ignores the search string. */
export function HudPageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentIndex = spaceIndex(pathname);
  const prevIndexRef = useRef(currentIndex);

  const prevIndex = prevIndexRef.current;
  const direction = currentIndex === -1 || prevIndex === -1 || currentIndex === prevIndex
    ? "forward"
    : currentIndex > prevIndex ? "forward" : "back";

  // Updates after commit, not during render -- this render's `direction`
  // must compare against the *previous* commit's index, so the write has to
  // happen post-render (see the "previous value" ref pattern) rather than
  // mutating the ref inline while rendering.
  useEffect(() => {
    prevIndexRef.current = currentIndex;
  }, [currentIndex]);

  return (
    <div key={pathname} className="hud-page-transition" data-direction={direction}>
      {children}
    </div>
  );
}
