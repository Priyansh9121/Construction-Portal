/**
 * File purpose:
 * The application shell for every authenticated screen: navigation, top
 * bar, background, page transition and the floating action button.
 *
 * Props:
 * - children    the page being rendered
 * - activePage  the page title shown in the top bar
 * - user        the signed-in user, for the menu and role-based nav
 *
 * Child components:
 * - Sidebar               role-filtered navigation (drawer below 1024px)
 * - Topbar                page title, notifications, account menu
 * - PageTransition        animates between pages
 * - FloatingActionButton  quick-create shortcut
 * - CommandPalette        keyboard-driven navigation and search
 *
 * Responsive navigation:
 * This component owns the drawer's open state, because two things open it
 * (the topbar button) and three close it (the scrim, the close button, and
 * navigating to a new route).
 *
 * Previously the shell rendered a permanent 250px sidebar at every width
 * PLUS a second horizontal `.mobile-page-nav` strip duplicating a subset of
 * the same links. On a phone that meant two competing navigations and a
 * squeezed content column. The strip is gone; below 1024px the sidebar is
 * an off-canvas drawer.
 *
 * Accessibility of the drawer:
 * - Escape closes it.
 * - Body scrolling is locked while it is open, so the page behind does not
 *   move under the user's finger.
 * - Focus moves into the drawer when it opens and returns to the button
 *   that opened it when it closes.
 * - Focus is trapped inside while open — Tab from the last item wraps to
 *   the first rather than walking into the page behind the scrim.
 * - The toggle carries aria-expanded and aria-controls.
 *
 * Connected to:
 * - Wraps protected routes in AppRoutes.jsx
 * - Public pages (login, register, reset) render WITHOUT this shell
 *
 * Important notes:
 * - Which nav items appear is a presentation decision only — the backend
 *   gates the endpoints behind them regardless.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useLocation } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import PageTransition from "../components/PageTransition";
import FloatingActionButton from "../components/FloatingActionButton";
import CommandPalette from "../components/CommandPalette";

/** Everything focusable, for the drawer's focus trap. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The width at which the drawer becomes a permanent sidebar. Matches shell.css. */
const DESKTOP_QUERY = "(min-width: 1024px)";

function AppLayout({
  children,
  activePage,
  user,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const location = useLocation();
  const toggleRef = useRef(null);
  const sidebarRef = useRef(null);

  /*
   * Whether the sidebar is permanently visible.
   *
   * Needed in JS, not just CSS, because `inert` is an attribute — a media
   * query cannot apply it. Initialised from matchMedia so the first render
   * is already correct rather than flipping after mount.
   */
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(DESKTOP_QUERY).matches
  );

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);

    const handleChange = (event) => setIsDesktop(event.matches);

    query.addEventListener("change", handleChange);

    return () => query.removeEventListener("change", handleChange);
  }, []);

  const closeDrawer = useCallback(
    () => setDrawerOpen(false),
    []
  );

  /*
   * Close on route change.
   *
   * Derived from the pathname during render rather than in an effect:
   * setting state inside an effect triggers a second render pass, and the
   * hooks lint rule rejects it. Comparing the rendered-for path with the
   * current one closes the drawer in the same pass that navigates.
   *
   * Every NavLink also calls onClose directly, so this only has to catch
   * programmatic navigation (the command palette, a redirect).
   */
  const [renderedPath, setRenderedPath] = useState(location.pathname);

  if (renderedPath !== location.pathname) {
    setRenderedPath(location.pathname);

    if (drawerOpen) {
      setDrawerOpen(false);
    }
  }

  /*
   * Lock body scroll while open. Set as a data attribute rather than an
   * inline style so the rule lives in CSS with the rest of the shell.
   */
  useEffect(() => {
    if (drawerOpen) {
      document.body.dataset.drawerOpen = "true";
    } else {
      delete document.body.dataset.drawerOpen;
    }

    return () => {
      delete document.body.dataset.drawerOpen;
    };
  }, [drawerOpen]);

  /*
   * Escape to close, and a focus trap while open.
   *
   * The trap matters because the drawer is a fixed overlay: without it Tab
   * walks straight past the visible panel into the page behind the scrim,
   * and a keyboard user loses track of where they are.
   */
  useEffect(() => {
    if (!drawerOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const panel = sidebarRef.current;

      if (!panel) {
        return;
      }

      const items = Array.from(
        panel.querySelectorAll(FOCUSABLE)
      ).filter((node) => node.offsetParent !== null);

      if (items.length === 0) {
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [drawerOpen]);

  /*
   * Move focus into the drawer when it opens, and back to the toggle when
   * it closes — so a keyboard user is not left focused on a button that has
   * just been hidden.
   */
  useEffect(() => {
    if (drawerOpen) {
      /*
       * Scope the search to the panel itself, not the wrapper.
       *
       * The wrapper also contains the scrim, which comes first in DOM order
       * and becomes focusable when the drawer opens — so searching the
       * wrapper put initial focus on the dismiss overlay rather than on the
       * navigation. A screen reader user was announced "Close navigation
       * menu" as the first thing in a menu they had just asked to open.
       */
      const panel = sidebarRef.current?.querySelector("#app-sidebar");
      const target = panel?.querySelector(FOCUSABLE);

      target?.focus();
    } else if (document.body.dataset.drawerWasOpen === "true") {
      toggleRef.current?.focus();
      delete document.body.dataset.drawerWasOpen;
    }

    if (drawerOpen) {
      document.body.dataset.drawerWasOpen = "true";
    }
  }, [drawerOpen]);

  return (
    <div className="app-layout v2-root">
      {/*
        First tab stop on every page. Lets a keyboard or screen-reader user
        jump the navigation instead of tabbing through ~15 links on every
        route change.
      */}
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      {/*
        `inert` while the drawer is closed on a small screen. The panel is
        only moved off-canvas with a transform, and a transformed element is
        still in the tab order — without this, Tab walks into a menu the user
        cannot see. Never inert at >= 1024px, where the sidebar is visible.
      */}
      <div ref={sidebarRef} inert={!isDesktop && !drawerOpen}>
        <Sidebar
          user={user}
          open={drawerOpen}
          onClose={closeDrawer}
        />
      </div>

      <div className="main-content">
        <Topbar
          activePage={activePage}
          onOpenMenu={() => setDrawerOpen(true)}
          menuOpen={drawerOpen}
          toggleRef={toggleRef}
        />

        <main
          id="main-content"
          className="page-content"
          tabIndex={-1}
        >
          <PageTransition>
            {children}
          </PageTransition>
        </main>
      </div>

      <FloatingActionButton />

      <CommandPalette />
    </div>
  );
}

export default AppLayout;
