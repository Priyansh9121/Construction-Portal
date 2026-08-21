/**
 * The WebGL construction world behind the authentication routes.
 *
 * Renders a canvas and lazily loads three.js into it. Until that resolves — and
 * for ever, if the device cannot run it — the caller's authored SVG scene is
 * what the user sees. The form is mounted, focusable and submittable from the
 * first frame either way: authentication never waits for a world.
 *
 * The world is deliberately NOT remounted per auth route. Login, Register,
 * Forgot and Reset are stations inside one environment, so the scene persists
 * and only the camera and the form plane move.
 */

import { useEffect, useRef, useState } from "react";

import { WORLD_STATE } from "../../world/loginSite";

function AuthWorld({ onReady }) {
  const canvasRef = useRef(null);
  const worldRef = useRef(null);
  const cleanupRef = useRef(null);
  /*
   * `live` is what fades the authored SVG fallback out, so it must mean "the
   * authored world is ON SCREEN" -- not "a renderer was constructed".
   *
   * It used to be set the moment `createAuthWorld` resolved. That function's
   * only await is the three.js import; the GLB layers arrive afterwards. So on
   * any deploy where those layers failed, the fallback was already gone and
   * the user got an empty sky. That is exactly what production showed during
   * the CSP incident, and the page had no way to know it was wrong.
   */
  const [state, setState] = useState(WORLD_STATE.INITIALISING);
  const live = state === WORLD_STATE.READY;

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    /*
     * The world is loaded when the browser is IDLE, never as part of the
     * page's critical path.
     *
     * Importing it eagerly pulled a 724 kB chunk into the auth routes' initial
     * network activity, which held `networkidle` open long enough to time out
     * a registration test — the form was fine, but the route was no longer
     * quiet when the user reached it. Deferring to idle means the form paints,
     * settles and becomes interactive first, and the world arrives into a
     * quiet page.
     */
    const start = () => (async () => {
      try {
        const { createAuthWorld, CAPABLE } = await import("../../world/authWorld");
        if (cancelled || !CAPABLE()) return;

        /* Time of day is art direction, fixed for the product. The override
         * exists so the three concepts can be rendered and compared from the
         * same build rather than from three branches. */
        const world = await createAuthWorld(canvas, {
          time: window.__AUTH_TIME || "dusk",
          /* An instant to drive the world to, for looking at it. The sun and
           * moon come from the real clock, so without this a night render
           * means waiting until night. Never set in the product. */
          at: window.__AUTH_AT || undefined,
          /* A forced forecast, for looking at weather that is not happening
           * in Ahmedabad right now. Never set in the product. */
          weather: window.__AUTH_WEATHER || undefined,
          /* The world tells us when it is genuinely ready; we never guess.
           * DEGRADED and FAILED both keep the fallback on screen, which is the
           * whole point of routing this through state rather than a boolean. */
          onState: (next) => { if (!cancelled) setState(next); },
        });
        if (cancelled) {
          world.dispose();
          return;
        }
        worldRef.current = world;
        onReady?.(world);

        /*
         * THE INTERACTION BRIDGE.
         *
         * The form talks to the world by dispatching events, never by holding
         * a reference to it. The coupling stays one-directional and
         * presentation-only: no authentication state crosses here, and a form
         * rendered with no world behaves identically because nothing listens.
         */
        const onFocus = (e) => world.focus(e.detail);
        const onArm = () => world.arm();
        const onRelax = () => world.relax();
        const onDepart = () => world.depart?.();
        document.addEventListener("auth:focus", onFocus);
        document.addEventListener("auth:arm", onArm);
        document.addEventListener("auth:relax", onRelax);
        document.addEventListener("auth:depart", onDepart);
        cleanupRef.current = () => {
          document.removeEventListener("auth:focus", onFocus);
          document.removeEventListener("auth:arm", onArm);
          document.removeEventListener("auth:relax", onRelax);
          document.removeEventListener("auth:depart", onDepart);
        };
      } catch (error) {
        /* A world that fails to build is a missing decoration, not a broken
         * page. The fallback is already on screen and the form already works,
         * so this is logged and the state says so. */
        console.warn("Auth world unavailable:", error);
        if (!cancelled) setState(WORLD_STATE.FAILED);
      }
    })();

    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(start, { timeout: 2500 })
      : window.setTimeout(start, 400);

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      worldRef.current?.dispose();
      worldRef.current = null;
    };
  }, [onReady]);

  return (
    <canvas
      ref={canvasRef}
      className="auth-world"
      data-live={live ? "1" : undefined}
      /* Readable from the DOM so a test -- and a future incident -- can tell
       * "still loading" apart from "loaded without its architecture". */
      data-world-state={state}
      aria-hidden="true"
    />
  );
}

export default AuthWorld;
