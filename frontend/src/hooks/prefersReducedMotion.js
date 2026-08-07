/**
 * File purpose:
 * One reading of the user's motion preference, shared by the navigation
 * primitives.
 *
 * Read at call time rather than cached: the preference can change while the
 * application is open, and a stale value would keep animating for someone who
 * has just turned it off.
 */

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
