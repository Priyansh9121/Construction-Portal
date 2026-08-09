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
 * single frame is scheduled. Applying the session and clearing the
 * credentials all happen at that moment. Whatever follows is decoration over
 * a fact that has already occurred.
 *
 * If the browser lacks View Transitions, if the animation throws, if the user
 * navigates away mid-flight, or if `matchMedia` is unavailable, the commit has
 * already run. There is no path through this file where a visual failure can
 * cost someone their session.
 *
 * The security-critical half — the API call, the token, the stored user —
 * happens in `App.jsx` before this is ever called. This module never sees a
 * credential.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS IS NOT THE VIEW TRANSITIONS API — MEASURED, NOT ASSUMED
 * ─────────────────────────────────────────────────────────────────────────
 * It was, twice, and both versions were wrong in ways only a frame recording
 * could show.
 *
 *   v1  `startViewTransition(() => {})` — an empty callback. The API
 *       photographs the page, runs the callback, photographs it again. Two
 *       photographs of the same frame animate nothing, so the signature
 *       moment was, at runtime, an ordinary route swap.
 *
 *   v2  the callback forced React to render inside the capture window. Better
 *       in theory; three defects in practice. Returning a promise that waited
 *       for an animation frame DEADLOCKED, because rendering is suspended
 *       between the two photographs, so the frame never arrives. Rendering
 *       synchronously instead put a SUSPENSE FALLBACK in the second
 *       photograph, because every destination route is lazy and cannot resolve
 *       without yielding. And with the transition slowed to three seconds and
 *       screenshotted mid-flight, the first photograph turned out to be WHITE:
 *       React had already committed the new DOM before `startViewTransition`
 *       ran, so the browser photographed a page the scene had already left.
 *
 * The last one is fatal to the approach as this application is built. The API
 * needs to photograph before the DOM changes; the rule at the top of this file
 * needs the session applied before anything visual happens. Both cannot be
 * first.
 *
 * So the departure is owned outright instead, by one element this module adds
 * and removes itself:
 *
 *   1. a full-viewport layer is inserted BEFORE the commit, transparent
 *   2. it fades up in the scene's own sky colour   — the light going down
 *   3. it warms through to the application canvas  — the ground lightening
 *   4. it dissolves                                — the application is
 *                                                    already standing there
 *
 * Nothing is photographed, so nothing can be photographed at the wrong moment.
 * The layer covers the instant React swaps the route, which is what removes
 * the blank frame; and it gives a lazy destination the whole 260ms to arrive
 * instead of demanding it be ready inside a synchronous render.
 *
 * It is `pointer-events: none` for its whole life and it is removed from the
 * document at the end, so there is no state in which it can swallow a click.
 *
  * ─────────────────────────────────────────────────────────────────────────
 * DESTINATION-AGNOSTIC BY CONSTRUCTION
 * ─────────────────────────────────────────────────────────────────────────
 * This module never sees a role or a route. The caller applies the session and
 * the router decides where that leads — admin and manager to operations, a
 * worker to the field workspace, a subcontractor to their projects — and the
 * grammar is identical for all of them, because the transition describes
 * *leaving the scene*, not *arriving somewhere specific*.
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
 * pure black (`--auth-sky-deep`) and the canvas is deliberately not pure white
 * (`--ui-canvas`), for exactly this reason: either extreme makes the change a
 * flash no easing can soften.
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

/**
 * Mark the document for the duration of the transition.
 *
 * A data attribute rather than a class so the state is queryable, greppable
 * and impossible to confuse with styling. `auth/transition.css` owns what it
 * looks like; this file owns only when it is true. Probes read it to know the
 * transition ran at all, which is the only externally observable proof that
 * a sign-in went through the threshold rather than around it.
 */
function mark(state) {
  if (typeof document === "undefined") return;
  if (state) document.documentElement.setAttribute("data-auth-leaving", "");
  else document.documentElement.removeAttribute("data-auth-leaving");
}

/**
 * Insert the departure layer.
 *
 * Created here rather than rendered by React on purpose: it must exist BEFORE
 * the commit and survive the render that unmounts the entire sign-in tree. A
 * React element cannot do both — it would be a child of the thing it has to
 * outlive.
 */
function openDeparture() {
  if (typeof document === "undefined") return null;
  const layer = document.createElement("div");
  layer.className = "auth-departure";
  /* Announced to nobody: the arrival is communicated by the destination
   * itself, and a live region here would interrupt a screen reader mid-
   * navigation to describe a colour. */
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);
  return layer;
}

function closeDeparture(layer) {
  mark(false);
  if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
}

/**
 * Run the authentication transition.
 *
 * @param {() => void} commit   applies the authenticated session. Called
 *                              synchronously, before any animation.
 * @returns {Promise<void>}     resolves when presentation finishes. Callers
 *                              may ignore it; nothing depends on it.
 */
export function runAuthTransition(commit) {
  /*
   * The layer goes in first so it is already in the document when the commit
   * tears the sign-in screen down. It is transparent at this instant — see
   * the keyframes in auth/transition.css — so inserting it changes nothing
   * the user can see.
   */
  const layer = typeof document === "undefined" ? null : openDeparture();
  if (layer) mark(true);

  /*
   * THE COMMIT. Not in a callback, not in a promise, not after a frame. If
   * everything below this line failed, the user would still be signed in and
   * the router would still be taking them to their destination.
   */
  if (typeof commit === "function") commit();

  if (typeof document === "undefined") return Promise.resolve();

  const duration = prefersReducedMotion() ? REDUCED_MS : TRANSITION_MS;

  /*
   * Torn down on a timer rather than on `animationend`. An animation event
   * that never fires — a layer removed by something else, a tab backgrounded
   * mid-flight, `prefers-reduced-motion` changing between the two reads —
   * would leave the layer in the document forever. A timeout cannot not fire.
   *
   * The margin is small and fixed: enough to outlast the animation, short
   * enough that the layer is provably gone well before anyone reaches for the
   * screen.
   */
  return new Promise((resolve) => {
    window.setTimeout(() => {
      closeDeparture(layer);
      resolve();
    }, duration + 40);
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
