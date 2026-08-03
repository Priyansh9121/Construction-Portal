/**
 * File purpose:
 * The decorative background layer behind the application shell.
 *
 * Props:
 * - none
 *
 * Rendered by:
 * - AppLayout.jsx
 *
 * Important notes:
 * - Purely presentational, and deliberately trivial. Kept as a component so
 * - the layout reads as a stack of layers.
 */

function AppBackground() {
    return (
      <div className="app-bg-effects" aria-hidden="true">
        <div className="bg-blob bg-blob-one" />
        <div className="bg-blob bg-blob-two" />
        <div className="bg-grid" />
      </div>
    );
  }
  
  export default AppBackground;