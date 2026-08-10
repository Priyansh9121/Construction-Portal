import { useEffect, useRef } from "react";

/**
 * One rAF scheduler for the finance instrument's geometry morph.
 *
 * React state is never touched during a tween. The callback writes SVG
 * attributes directly on refs, at most once per frame, and reads nothing from
 * layout — sixty re-renders a second would cost far more than the transition
 * is worth, and interleaved reads would force synchronous layout.
 *
 * Latest interaction wins: starting a tween cancels the one in flight, so
 * rapid timeframe switching never leaves two schedulers fighting over the same
 * attributes. The final frame is written with t exactly 1, so the DOM lands on
 * the state React also believes in.
 */
export default function useTween() {
  const frame = useRef(0);
  const live = useRef(false);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      live.current = false;
    },
    []
  );

  return useRef({
    /** `onFrame(t)` with t 0→1 on an authored curve. Returns immediately with
     * t=1 when the caller asks for no duration (reduced motion). */
    run(duration, onFrame, onDone) {
      cancelAnimationFrame(frame.current);

      if (duration <= 0) {
        onFrame(1);
        onDone?.();
        return;
      }

      const start = performance.now();
      live.current = true;

      const step = (now) => {
        if (!live.current) return;
        const raw = Math.min(1, (now - start) / duration);

        /* Decelerating, no overshoot. A financial instrument reconfiguring
         * should settle onto its new reading, not bounce past it. */
        const t = 1 - (1 - raw) ** 3;

        onFrame(t);

        if (raw < 1) frame.current = requestAnimationFrame(step);
        else onDone?.();
      };

      frame.current = requestAnimationFrame(step);
    },

    stop() {
      cancelAnimationFrame(frame.current);
    },
  }).current;
}
