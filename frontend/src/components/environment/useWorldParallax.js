/**
 * File purpose:
 * The single scheduler that moves the world's depth planes.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ONE LISTENER, ONE FRAME, ONE CUSTOM PROPERTY
 * ─────────────────────────────────────────────────────────────────────────
 * Parallax is the easiest way to build a page that stutters. The rules this
 * hook exists to enforce:
 *
 *   - Listeners are passive, so scrolling is never blocked waiting on us.
 *   - Events set a variable; they never write to the DOM. A single rAF, at
 *     most one per frame, does the write. A burst of forty scroll events
 *     between two frames performs one write, not forty.
 *   - Nothing here READS layout. No getBoundingClientRect, no offsetTop, no
 *     ResizeObserver. Reading inside a scroll handler is what causes forced
 *     synchronous layout, and it is why most parallax is janky.
 *   - The write is two custom properties on ONE element. The planes consume
 *     them in a `transform`, so the browser composites; nothing repaints.
 *   - React state is never touched. A component that re-rendered every frame
 *     would cost more than the effect is worth.
 *
 * Reduced motion is honoured at the source rather than by animating into a
 * stationary value: the listeners are never attached, so a user who has asked
 * for less motion does not pay for a scheduler that then discards its work.
 */

import { useEffect } from "react";

export default function useWorldParallax(ref, { scroll = 0.4, pointer = 0 } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return undefined;

    let y = window.scrollY;
    let px = 0;
    let queued = false;

    const write = () => {
      queued = false;
      el.style.setProperty("--world-scroll", `${y * scroll}px`);
      if (pointer) el.style.setProperty("--world-px", px.toFixed(3));
    };

    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(write);
    };

    const onScroll = () => {
      y = window.scrollY;
      schedule();
    };

    /* Pointer parallax is deliberately shallow and deliberately damped. A
     * plane that tracks the cursor exactly reads as a gimmick; a plane that
     * leans a few pixels reads as depth. The coefficient lives in CSS so the
     * amount is tunable next to the thing it moves. */
    const onPointer = (e) => {
      px = (e.clientX / window.innerWidth - 0.5) * 2;
      schedule();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    if (pointer) window.addEventListener("pointermove", onPointer, { passive: true });
    schedule();

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (pointer) window.removeEventListener("pointermove", onPointer);
    };
  }, [ref, scroll, pointer]);
}
