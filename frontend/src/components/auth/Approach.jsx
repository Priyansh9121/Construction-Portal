/**
 * File purpose:
 * The supporting visual for every authentication screen.
 *
 * Concept:
 * "Signing in is an act of routing, not passing a gate." That is a product
 * fact rather than a metaphor: four roles resolve to three destinations,
 * getHomePath exists because "/" means something different per role, and
 * ?next= already preserves where an expired session was working.
 *
 * So this draws convergence. Several paths enter spread apart and resolve
 * toward a single exit vector. It is abstract directional flow, deliberately
 * NOT a transit map: there are no nodes, no stations, no labels, no legend,
 * no grid, no measurement marks and no scale. Those would land it straight in
 * the airport-signage cliché the direction rejects.
 *
 * Replaces StructuralFrame, which was a literal architectural section
 * (columns, floor plates, brace, dimension line) and is rejected because the
 * product must feel like premium software, not themed software. See AUTH-003
 * in FRESH_UI_ISSUES.md.
 *
 * Engineering rules inherited from StructuralFrame, which were correct:
 * - It DRAWS ONCE. `both` fill, no iteration count. A permanently animating
 *   background is a permanent compositing cost on a phone, for decoration.
 *   There is no loop here and there must never be one.
 * - Pure SVG geometry. No image request, no canvas, no WebGL, no dependency.
 * - Decorative, so the panel that holds it is aria-hidden and this is
 *   focusable="false".
 * - Under prefers-reduced-motion the CSS shows the resolved figure with no
 *   draw. The picture is the point, not the drawing of it.
 *
 * Never sits behind text: it occupies open area only, so it cannot degrade
 * any contrast ratio.
 */

function Approach() {
  return (
    <svg
      className="auth-approach"
      viewBox="0 0 400 520"
      fill="none"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid slice"
    >
      {/*
        Five routes entering spread apart on the left and resolving toward a
        common vector on the right. The spread is uneven on purpose: evenly
        fanned lines read as a diagram, uneven ones read as movement.
      */}
      <g className="auth-approach__routes">
        <path d="M-20 78C120 78 168 236 420 236" />
        <path d="M-20 168C104 168 176 240 420 240" />
        <path d="M-20 262C 96 262 180 244 420 244" />
        <path d="M-20 372C128 372 172 252 420 248" />
        <path d="M-20 462C144 462 164 258 420 252" />
      </g>

      {/*
        The resolved vector. Heavier than the routes and drawn last, so the
        eye finishes where the destination is rather than where the paths
        began.
      */}
      <g className="auth-approach__resolved">
        <path d="M236 244H420" />
      </g>
    </svg>
  );
}

export default Approach;
