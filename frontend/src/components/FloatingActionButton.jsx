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
import { Link } from "react-router-dom";
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
      <AnimatePresence>
        {open && (
          <motion.div
            className="fab-menu"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
          >
            {actions.map((action, index) => (
              <motion.div
                key={action.path}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Link to={action.path} onClick={() => setOpen(false)}>
                  + {action.label}
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        className="fab-button"
        onClick={() => setOpen((prev) => !prev)}
        whileHover={{ scale: 1.08, rotate: 8 }}
        whileTap={{ scale: 0.92 }}
      >
        {open ? "×" : "+"}
      </motion.button>
    </div>
  );
}

export default FloatingActionButton;