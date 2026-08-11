/**
 * File purpose:
 * The quick-create shortcut in the corner of the shell.
 *
 * Props:
 * - The action set for the current page, and the user for role filtering
 *
 * State and hooks:
 * - Local open state for the action menu
 *
 * Rendered by:
 * - AppLayout.jsx
 *
 * Important notes:
 * - Which actions appear depends on the role, but that is presentation only —
 * - the endpoints behind them are gated on the backend.
 */

import { useState } from "react";
import AppLink from "./ui/AppLink";
import { motion, AnimatePresence } from "framer-motion";

function FloatingActionButton() {
  const [open, setOpen] = useState(false);

  const actions = [
    { label: "Payment", path: "/payments" },
    { label: "Site", path: "/sites" },
    { label: "Tender", path: "/tenders" },
    { label: "Invoice", path: "/invoices" },
    { label: "Worker", path: "/workers" },
  ];

  return (
    <div className="fab-wrapper">
      {/*
        The actions emerge FROM the control rather than arriving beside it: the
        menu's transform origin is the control's own corner, so opening reads
        as the joint extending its arm. A detached panel sliding up from
        nowhere was the previous behaviour and had no spatial relationship to
        the thing that opened it.
      */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fab-menu"
            initial={{ opacity: 0, scaleX: 0.72, scaleY: 0.4 }}
            animate={{ opacity: 1, scaleX: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleX: 0.72, scaleY: 0.4 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          >
            {actions.map((action, index) => (
              <motion.div
                key={action.path}
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 + index * 0.045, ease: [0.16, 1, 0.3, 1] }}
              >
                <AppLink to={action.path} onClick={() => setOpen(false)}>
                  {action.label}
                </AppLink>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/*
        A command joint, not a floating circle. The crosshair is setting-out
        notation, and it does not spin into an unrelated glyph: the SAME
        geometry rotates 45 degrees so the cross reads as a close mark. One
        object, two states.
      */}
      <button
        type="button"
        className="fab-button"
        aria-expanded={open}
        aria-label={open ? "Close quick actions" : "Quick actions"}
        onClick={() => setOpen((prev) => !prev)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle className="fab-ring" cx="12" cy="12" r="7.5" />
          <path className="fab-cross" d="M12 3.5v17M3.5 12h17" />
        </svg>
      </button>
    </div>
  );
}

export default FloatingActionButton;