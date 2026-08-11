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

function AuthWorld({ onReady }) {
  const canvasRef = useRef(null);
  const worldRef = useRef(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    (async () => {
      try {
        const { createAuthWorld, CAPABLE } = await import("../../world/authWorld");
        if (cancelled || !CAPABLE()) return;

        /* Time of day is art direction, fixed for the product. The override
         * exists so the three concepts can be rendered and compared from the
         * same build rather than from three branches. */
        const world = await createAuthWorld(canvas, {
          time: window.__AUTH_TIME || "dusk",
        });
        if (cancelled) {
          world.dispose();
          return;
        }
        worldRef.current = world;
        setLive(true);
        onReady?.(world);
      } catch (error) {
        /* A world that fails to build is a missing decoration, not a broken
         * page. The fallback is already on screen and the form already works,
         * so this is logged and nothing else happens. */
        console.warn("Auth world unavailable:", error);
      }
    })();

    return () => {
      cancelled = true;
      worldRef.current?.dispose();
      worldRef.current = null;
    };
  }, [onReady]);

  return (
    <canvas
      ref={canvasRef}
      className="auth-world"
      data-live={live ? "1" : undefined}
      aria-hidden="true"
    />
  );
}

export default AuthWorld;
