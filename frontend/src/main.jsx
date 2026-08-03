/**
 * File purpose:
 * The application entry point. Vite loads this file; it mounts React,
 * installs the router and the auth provider, and imports every stylesheet
 * in the order they must cascade.
 *
 * Responsibilities:
 * - Mount the React tree into #root
 * - Wrap the app in BrowserRouter and AuthProvider
 * - Import all global CSS, in cascade order
 * - Configure the toast notification host
 *
 * Connected to:
 * - Loaded by index.html via a module script tag.
 * - Renders App.jsx, which renders AppRoutes.jsx.
 * - AuthProvider must sit ABOVE App, because RoleRoute and every page read
 *   the auth context.
 * - BrowserRouter must sit above AuthProvider, because the provider's
 *   redirect behaviour depends on router context being available.
 *
 * Important notes:
 * - The stylesheet import ORDER is load-bearing, not alphabetical. Core,
 *   then shared components, then pages, then responsive last so its media
 *   queries can override everything above. Reordering these changes the
 *   rendered layout — see the comment above the responsive import.
 * - StrictMode double-invokes effects in development. That is why
 *   AuthProvider's /auth/me effect carries a `cancelled` flag: without it
 *   the doubled call would race itself.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import {
  Toaster,
} from "react-hot-toast";

import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthProvider";

/*
 * Base Vite/global stylesheet.
 */
import "./index.css";

/*
 * Core styles.
 */
import "./styles/core/global.css";
import "./styles/core/layout.css";
import "./styles/core/utilities.css";
import "./styles/core/animations.css";

/*
 * Shared component styles.
 */
import "./styles/components/cards.css";
import "./styles/components/forms.css";
import "./styles/components/tables.css";
import "./styles/components/tabs.css";
import "./styles/components/modal.css";

/*
 * Page-specific styles.
 */
import "./styles/pages/auth.css";
import "./styles/pages/dashboard.css";
import "./styles/pages/payments.css";
import "./styles/pages/tenders.css";
import "./styles/pages/tender-details.css";
import "./styles/pages/worker-portal.css";
import "./styles/pages/subcontractor-portal.css";
import "./styles/pages/reports.css";
import "./styles/pages/settings.css";
import "./styles/pages/site-operations.css";

/*
 * Responsive rules remain last so they can override desktop
 * component and page styling at smaller screen widths.
 */
import "./styles/core/responsive.css";

const rootElement =
  document.getElementById("root");

if (!rootElement) {
  throw new Error(
    'Unable to start the application because the element with id "root" was not found.'
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />

        <Toaster
          position="top-right"
          reverseOrder={false}
          gutter={10}
          toastOptions={{
            duration: 4000,
            success: {
              duration: 3000,
            },
            error: {
              duration: 5000,
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);