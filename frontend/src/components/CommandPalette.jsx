/**
 * File purpose:
 * Keyboard-first navigation. Ctrl/Cmd+K, type, arrow, Enter.
 *
 * Rendered by:
 * - AppLayout.jsx
 *
 * ACCESSIBILITY MODEL (SHELL-011)
 * The palette is a modal dialog containing a combobox that controls a listbox
 * of destinations. That pairing was chosen because it describes what this
 * actually is — "a search field controlling a selectable set of navigation
 * results" — rather than because it reads well:
 *
 * - The surface is `role="dialog"` with `aria-modal="true"` and an accessible
 *   name, so assistive technology announces that a dialog opened and that the
 *   rest of the page is inert.
 * - The input is `role="combobox"` with `aria-expanded`, `aria-controls` and
 *   `aria-activedescendant`. Focus STAYS in the input while the selection
 *   moves, which is why activedescendant is the right model here and a roving
 *   tabindex is not: a roving tabindex would move real focus out of the field
 *   the user is still typing into.
 * - Results are `role="option"` inside `role="listbox"`, each carrying
 *   `aria-selected`.
 *
 * Selection is never signalled by colour alone: the selected option also
 * carries a positional marker and heavier weight. See the stylesheet.
 *
 * MOTION (SHELL-012)
 * The entrance previously translated 35px and scaled from 0.94 through Framer
 * props, which ignore `prefers-reduced-motion` because Framer does not apply
 * it to explicit values. It now reads the project's own
 * `prefersReducedMotion()` and collapses to a plain opacity change. Exit stays
 * faster than entrance in both modes.
 *
 * Motion never gates input. `autoFocus` puts the caret in the field on the
 * first frame, so typing, arrowing and Enter all work while the entrance is
 * still running.
 *
 * SHELL-005
 * `.command-backdrop` is a behavioural hook: `useDismissableOverlay` queries
 * it to decide this surface outranks every dropdown for Escape. The class name
 * is load-bearing and must not be renamed. This component's own Escape handler
 * is unchanged, so the precedence it participates in is unchanged.
 *
 * Important notes:
 * - The destination list is static. It does NOT filter by role; see SHELL-018.
 *   RoleRoute and the backend still enforce access, so an unreachable entry
 *   redirects rather than exposing anything.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import useAppNavigate from "../hooks/useAppNavigate";
import { prefersReducedMotion } from "../hooks/prefersReducedMotion";

const commands = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Finance / Payments", path: "/payments" },
  { name: "Invoices", path: "/invoices" },
  { name: "Workers", path: "/workers" },
  { name: "Worker Money", path: "/worker-money" },
  { name: "Subcontractors", path: "/subcontractors" },
  { name: "Sites / Projects", path: "/sites" },
  { name: "Tenders", path: "/tenders" },
  { name: "Daily Site Updates", path: "/daily-site-updates" },
  { name: "Update Approvals", path: "/daily-update-approvals" },
  { name: "Reports", path: "/reports" },
  { name: "Settings", path: "/settings" },
];

const LISTBOX_ID = "command-results";
const optionId = (index) => `command-option-${index}`;

function CommandPalette() {
  const navigate = useAppNavigate();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(0);

  const inputRef = useRef(null);
  const modalRef = useRef(null);

  /* Whatever had focus before the palette opened, so it can be given back. */
  const restoreRef = useRef(null);

  const filteredCommands = useMemo(
    () =>
      commands.filter((command) =>
        command.name.toLowerCase().includes(search.toLowerCase())
      ),
    [search]
  );

  /*
   * Keep the selection inside the result set, DERIVED rather than corrected in
   * an effect. Filtering can shrink the list under a selection that was valid
   * a keystroke ago, and an index past the end would make Enter do nothing and
   * point aria-activedescendant at an element that no longer exists.
   *
   * Clamping here rather than in a useEffect avoids a cascading re-render and
   * removes a whole class of bug: there is never a frame in which the rendered
   * selection is out of range.
   */
  const selectedIndex =
    filteredCommands.length === 0
      ? 0
      : Math.min(selected, filteredCommands.length - 1);

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
    setSelected(0);
  }, []);

  const goToPage = useCallback(
    (path) => {
      navigate(path);
      close();
    },
    [navigate, close]
  );

  /* Global shortcut. Escape is handled here so it keeps working even when
   * focus has not yet reached the dialog. */
  useEffect(() => {
    const listener = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => {
          /* Captured here, while the opener still holds focus. */
          if (!current) restoreRef.current = document.activeElement;
          return !current;
        });
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  /*
   * Give focus back when the palette closes.
   *
   * The opener is captured in the shortcut handler BELOW, not here. React
   * applies `autoFocus` during commit, before passive effects run, so an
   * effect reading `document.activeElement` on open records the palette's own
   * input rather than the element the user came from, and focus is then
   * "restored" to a node that no longer exists.
   */
  useEffect(() => {
    if (open) return undefined;

    const previous = restoreRef.current;
    restoreRef.current = null;

    if (previous && typeof previous.focus === "function" && document.contains(previous)) {
      previous.focus();
    }

    return undefined;
  }, [open]);

  /*
   * Focus containment. The dialog holds few focusable nodes, so a full trap
   * library is unnecessary: Tab and Shift+Tab wrap between the first and last
   * of them. Without this, Tab walks into the shell behind an `aria-modal`
   * surface, which contradicts what the attribute promises.
   */
  const handleTabTrap = useCallback((event) => {
    if (event.key !== "Tab" || !modalRef.current) return;

    /*
     * `:not([tabindex="-1"])` applies to EVERY branch, not just the last.
     * Without it the twelve result buttons counted as focusables, so the
     * input was never recognised as the final stop and Tab walked out of the
     * dialog. The options are deliberately tabindex="-1": focus stays in the
     * combobox and the selection moves via aria-activedescendant.
     */
    const focusables = modalRef.current.querySelectorAll(
      'button:not([tabindex="-1"]), [href]:not([tabindex="-1"]), ' +
        'input:not([tabindex="-1"]), select:not([tabindex="-1"]), ' +
        'textarea:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  const handleKeyDown = (event) => {
    handleTabTrap(event);

    if (filteredCommands.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((current) =>
        (Math.min(current, filteredCommands.length - 1) + 1) % filteredCommands.length
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected(
        (current) =>
          (Math.min(current, filteredCommands.length - 1) -
            1 +
            filteredCommands.length) %
          filteredCommands.length
      );
    } else if (event.key === "Home") {
      event.preventDefault();
      setSelected(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setSelected(filteredCommands.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = filteredCommands[selectedIndex];
      if (target) goToPage(target.path);
    }
  };

  /* Read at open time; the helper reads the media query at call time. */
  const reduced = open ? prefersReducedMotion() : false;

  const modalMotion = reduced
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.12 },
      }
    : {
        initial: { opacity: 0, y: 35, scale: 0.94 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 20, scale: 0.94 },
        /* Exit resolves faster than entrance. */
        transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
      };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="command-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.08 : 0.14 }}
          onClick={close}
        >
          <motion.div
            ref={modalRef}
            className="command-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onKeyDown={handleKeyDown}
            onClick={(event) => event.stopPropagation()}
            {...modalMotion}
          >
            <div className="command-header">
              <input
                ref={inputRef}
                autoFocus
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search pages..."
                aria-label="Search pages"
                role="combobox"
                aria-expanded="true"
                aria-controls={LISTBOX_ID}
                aria-autocomplete="list"
                aria-activedescendant={
                  filteredCommands.length > 0 ? optionId(selectedIndex) : undefined
                }
              />

              <span>ESC</span>
            </div>

            <div
              className="command-results"
              id={LISTBOX_ID}
              role="listbox"
              aria-label="Pages"
            >
              {filteredCommands.map((command, index) => (
                <button
                  key={command.path}
                  id={optionId(index)}
                  type="button"
                  role="option"
                  aria-selected={index === selectedIndex}
                  className={index === selectedIndex ? "is-selected" : undefined}
                  /* Focus stays in the combobox; these are not tab stops. */
                  tabIndex={-1}
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => goToPage(command.path)}
                >
                  <span>{command.name}</span>
                  <small>{command.path}</small>
                </button>
              ))}

              {filteredCommands.length === 0 && (
                <div className="command-empty" role="status">
                  No matching page found.
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CommandPalette;
