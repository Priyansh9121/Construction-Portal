import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import {
  Toaster,
} from "react-hot-toast";

import App from "./App.jsx";
import {
  AuthProvider,
} from "./contexts/AuthContext.jsx";

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