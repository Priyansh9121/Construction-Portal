import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./index.css";

import "./styles/core/global.css";
import "./styles/core/layout.css";
import "./styles/core/utilities.css";

import "./styles/components/cards.css";
import "./styles/components/forms.css";
import "./styles/components/tables.css";
import "./styles/components/tabs.css";
import "./styles/components/modal.css";

import "./styles/pages/auth.css";
import "./styles/pages/dashboard.css";
import "./styles/pages/payments.css";
import "./styles/pages/tenders.css";
import "./styles/pages/tender-details.css";
import "./styles/pages/worker-portal.css";
import "./styles/pages/subcontractor-portal.css";
import "./styles/pages/reports.css";
import "./styles/pages/settings.css";

import "./styles/core/responsive.css";

import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);