/**
 * File purpose:
 * Shared dismiss behaviour for the shell's dropdown-style overlays — the
 * account menu and the notification panel.
 *
 * Why this exists (V2-I023):
 * The notification panel had no Escape handling at all: it stayed open behind
 * the command palette with focus in an ambiguous place. The account menu, by
 * contrast, already had exactly the right semantics. Rather than write a
 * second, subtly different copy, that implementation was extracted here — two
 * consumers with identical needs is the bar for a shared helper, and one
 * source means the two overlays cannot drift apart.
 *
 * What it guarantees:
 * - Escape closes the overlay, and focus returns to the trigger. Without the
 *   focus return, focus is left on a node that has just been removed from the
 *   document, which strands a keyboard user at the top of the page.
 * - Pointer-down outside the container closes it.
 * - Listeners exist ONLY while the overlay is open, so a page does not carry
 *   document-level listeners for menus that are usually shut.
 * - Both are removed on unmount.
 *
 * Escape ownership
 * ----------------
 * Four things in this application listen for Escape: the command palette
 * (window), the mobile drawer (document), and these two dropdowns. All
 * document-level listeners fire regardless of what is "on top", so without
 * arbitration one Escape would dismiss several layers at once.
 *
 * Two rules resolve it:
 *
 *   1. A module-level stack. Overlays register on open and deregister on
 *      close, and only the most recently opened one responds.
 *   2. A modal surface outranks every dropdown. The palette and dialogs are
 *      the topmost layer by definition, so while one is mounted these
 *      overlays ignore Escape entirely and let it own the key.
 *
 * Rule 2 is a DOM check rather than stack participation on purpose: it leaves
 * the palette's and drawer's own handlers completely untouched, which is what
 * the brief requires.
 */

import { useEffect } from "react";

/** Most-recently-opened overlay last. Module scope: one stack per document. */
const openOverlays = [];

/** Surfaces that sit above any dropdown and therefore own Escape. */
const MODAL_SURFACES = ".command-backdrop, .modal-backdrop";

/**
 * @param {object}  options
 * @param {boolean} options.open        whether the overlay is currently open
 * @param {Function} options.onDismiss  called to close it
 * @param {object}  options.containerRef ref to the overlay's outer element
 * @param {object}  [options.triggerRef] ref to the control that opened it
 */
export default function useDismissableOverlay({
  open,
  onDismiss,
  containerRef,
  triggerRef,
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    // Identity token — the overlay's position in the stack. An object rather
    // than an index so removal stays correct if overlays close out of order.
    const token = {};
    openOverlays.push(token);

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        onDismiss();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") {
        return;
      }

      // Only the topmost dropdown responds.
      if (openOverlays[openOverlays.length - 1] !== token) {
        return;
      }

      // A modal surface outranks every dropdown; let it own the key.
      if (document.querySelector(MODAL_SURFACES)) {
        return;
      }

      onDismiss();
      triggerRef?.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      const index = openOverlays.indexOf(token);

      if (index !== -1) {
        openOverlays.splice(index, 1);
      }

      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onDismiss, containerRef, triggerRef]);
}
