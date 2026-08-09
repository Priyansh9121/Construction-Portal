/**
 * File purpose:
 * The presentation layer over a completed authentication event.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   Authentication never waits for animation.
 *
 * The API makes that structural rather than a discipline anyone has to
 * remember: `run` takes a `commit` callback and calls it FIRST, before a
 * single frame is scheduled. Token storage, role resolution and navigation all
 * happen at that moment. Whatever follows is decoration over a fact that has
 * already occurred.
 *
 * If the browser lacks View Transitions, if the animation throws, if the user
 * navigates away mid-flight, or if `matchMedia` is unavailable, the commit has
 * already run. There is no path through this file where a visual failure can
 * cost someone their session.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DESTINATION-AGNOSTIC BY CONSTRUCTION
 * ─────────────────────────────────────────────────────────────────────────
 * This module never sees a role or a route. The caller resolves where the user
 * is going and hands over a callback. Admin lands on operations, a worker on
 * the field workspace, a subcontractor on their claims — and the grammar is
 * identical for all of them, because the transition describes *leaving the
 * scene*, not *arriving somewhere specific*.
 *
 * That is also why it cannot drift: there is no branch here to add a role to.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THE DARK-TO-LIGHT MOMENT WORKS
 * ─────────────────────────────────────────────────────────────────────────
 * The risk identified in Phase 1B.5 was a hard cut, or a dark panel appearing
 * pasted over a light application.
 *
 * The resolution is that the LINEWORK IS CONTINUOUS. The scene's structural
 * lines and the application shell's hairlines are the same visual language —
 * that is the whole premise of Architectural Instrument. So the ground
 * lightens beneath lines that do not move, rather than one image dissolving
 * into another.
 *
 * There is no cross-fade through black or white. The sky is deliberately not
 * pure black (`--auth-sky-deep`) for exactly this reason: a true black start
 * makes the change a cut no easing can soften.
 */

/** Matches `--t-deliberate`. Long enough to read as intentional, short enough
 *  that nobody waits for it. */
const TRANSITION_MS = 260;

const REDUCED_MS = 90;

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function supportsViewTransitions() {
  return (
    typeof document !== "undefined" &&
    typeof document.startViewTransition === "function"
  );
}

/**
 * Mark the document for the duration of the transition.
 *
 * A data attribute rather than a class so the state is queryable, greppable
 * and impossible to confuse with styling. `auth/transition.css` owns what it
 * looks like; this file owns only when it is true.
 */
function mark(state) {
  if (typeof document === "undefined") return;
  if (state) document.documentElement.setAttribute("data-auth-leaving", "");
  else document.documentElement.removeAttribute("data-auth-leaving");
}

/**
 * Run the authentication transition.
 *
 * @param {() => void} commit   applies the authenticated state and navigates.
 *                              Called synchronously, before any animation.
 * @returns {Promise<void>}     resolves when presentation finishes. Callers
 *                              may ignore it; nothing depends on it.
 */
export function runAuthTransition(commit) {
  /*
   * FIRST. Not in a callback, not in a promise, not after a frame. If
   * everything below this line failed, the user would still be signed in and
   * on their destination.
   */
  if (typeof commit === "function") commit();

  if (typeof document === "undefined") return Promise.resolve();

  const reduced = prefersReducedMotion();
  const duration = reduced ? REDUCED_MS : TRANSITION_MS;

  const clear = () => {
    mark(false);
  };

  /*
   * View Transitions gives a real cross-document snapshot, so the scene and
   * the destination are composited rather than one being drawn over the other.
   * Where it is unavailable the fallback is not a lesser animation of the same
   * idea — it is a shorter, simpler one, because a JS-driven approximation of
   * a compositor feature is worse than an honest fade.
   */
  if (supportsViewTransitions() && !reduced) {
    mark(true);
    try {
      const vt = document.startViewTransition(() => {});
      return vt.finished.catch(() => {}).finally(clear);
    } catch {
      clear();
      return Promise.resolve();
    }
  }

  mark(true);
  return new Promise((resolve) => {
    window.setTimeout(() => {
      clear();
      resolve();
    }, duration);
  });
}

/**
 * Exposed for probes and for callers that need to reason about timing without
 * duplicating the number.
 */
export const authTransitionTiming = {
  full: TRANSITION_MS,
  reduced: REDUCED_MS,
};

export default runAuthTransition;
