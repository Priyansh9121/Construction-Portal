import { useEffect } from "react";

/**
 * The camera rig: one scheduler for the world's spatial response.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE CAMERA IS HEAVY
 * ─────────────────────────────────────────────────────────────────────────
 * Writing the pointer position straight onto the planes makes the world twitch
 * — the novelty tilt every portfolio site has. A real camera has mass, so the
 * target is set by the pointer and the camera CHASES it: each frame closes a
 * fixed fraction of the remaining distance, and the per-frame step is capped
 * so a fast flick across the viewport cannot snap the world sideways.
 *
 * The loop stops once the camera has arrived, and starts again on the next
 * event. A world at rest costs nothing.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THIS NEVER DOES
 * ─────────────────────────────────────────────────────────────────────────
 * No layout is read — no getBoundingClientRect, no offsetTop, no
 * ResizeObserver. Reading inside a scroll handler is what causes forced
 * synchronous layout and is why most parallax stutters. Listeners are passive,
 * writes are three custom properties on ONE element, and React state is never
 * touched: a component re-rendering at 60Hz would cost more than the effect is
 * worth.
 *
 * Under reduced motion nothing is attached at all, so a user who asked for
 * less motion does not pay for a scheduler that then discards its work.
 */

/** Fraction of the remaining distance closed per frame. */
const EASE = 0.085;

/** Maximum camera travel per frame, in normalised units. Velocity limit. */
const MAX_STEP = 0.022;

/** Below this the camera has arrived and the loop stops. */
const REST = 0.0006;

export default function useWorldParallax(ref, { scroll = 0.4, camera = 26 } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    /* Pointer parallax is meaningless without a pointer, and a phone's
     * accelerometer is not a camera the user is driving. */
    const fine = window.matchMedia("(pointer: fine)").matches;

    let targetX = 0;
    let targetY = 0;
    let camX = 0;
    let camY = 0;
    let scrollY = window.scrollY;
    let running = false;
    let frame = 0;

    const step = (current, target) => {
      const delta = (target - current) * EASE;
      return current + Math.max(-MAX_STEP, Math.min(MAX_STEP, delta));
    };

    const tick = () => {
      camX = step(camX, targetX);
      camY = step(camY, targetY);

      el.style.setProperty("--cam-x", `${(camX * camera).toFixed(2)}px`);
      el.style.setProperty("--cam-y", `${(camY * camera * 0.45).toFixed(2)}px`);
      el.style.setProperty("--world-scroll", `${scrollY * scroll}px`);

      if (Math.abs(targetX - camX) > REST || Math.abs(targetY - camY) > REST) {
        frame = requestAnimationFrame(tick);
      } else {
        running = false;
      }
    };

    const wake = () => {
      if (running) return;
      running = true;
      frame = requestAnimationFrame(tick);
    };

    const onPointer = (e) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * -2;
      targetY = (e.clientY / window.innerHeight - 0.5) * -2;
      wake();
    };

    const onScroll = () => {
      scrollY = window.scrollY;
      /* Scroll must land even when the camera is at rest, so it writes
       * directly rather than waiting for the chase loop. */
      el.style.setProperty("--world-scroll", `${scrollY * scroll}px`);
    };

    /* The pointer leaving means there is nothing to look at: the camera
     * returns to centre rather than holding its last position. */
    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      wake();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    if (fine) {
      window.addEventListener("pointermove", onPointer, { passive: true });
      document.addEventListener("pointerleave", onLeave);
    }
    onScroll();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [ref, scroll, camera]);
}
