/**
 * The form's half of the presentation bridge to the 3D world.
 *
 * Dispatching an event rather than calling a method keeps this one-directional:
 * the form never holds a reference to the world, never waits for it, and
 * behaves identically when there is no world at all — which is the case on a
 * software renderer, on a failed load, and in every test.
 *
 * Presentation only. Nothing here can affect authentication.
 */
const send = (type, detail) => {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent(type, { detail }));
};

/** A field took focus. `which` selects the camera's response. */
export const worldFocus = (which) => send("auth:focus", which);

/** Sign In was pressed: the world tightens but does not depart — the request
 * has not been answered yet. */
export const worldArm = () => send("auth:arm");

/** The attempt resolved without leaving: put the world back. */
export const worldRelax = () => send("auth:relax");
