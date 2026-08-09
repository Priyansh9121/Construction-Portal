/**
 * File purpose:
 * Public self-service signup: creates a company workspace and its first
 * administrator.
 *
 * State:
 * - Local: the form fields, loading, validation message.
 *
 * Hooks and context:
 * - useAuth for setUser after registration
 *
 * API endpoints:
 * - POST /auth/register via services/authService.js
 *
 * Parent:
 * - None — public route
 *
 * Navigation and children:
 * - On success the user is signed in immediately and lands on their role's
 * - home page rather than being sent back to the login screen.
 *
 * WHAT THIS FORM ACTUALLY CREATES (see AUTH-001):
 * The backend's register handler takes full_name, email, password and
 * company_name, and creates a users row, a companies row and an admin
 * company_users row in one transaction. The registrant ALWAYS becomes an
 * administrator and the company's owner. The endpoint reads no role from the
 * request and cannot be asked for one, because a signup producing a worker
 * would create a company nobody could administer.
 *
 * This page previously offered a worker/subcontractor role selector and never
 * sent company_name. The selector was dead UI — the API ignored it — and the
 * missing required field meant every submission returned 400 "Company name is
 * required", so public registration could not succeed at all. Both are fixed
 * here by aligning the frontend with the existing backend contract, which is
 * authoritative. Backend behaviour is unchanged.
 *
 * Workers, subcontractors and additional administrators are NOT created here.
 * They are provisioned through the authenticated company workflows, where
 * permissions apply.
 *
 * Important notes:
 * - industry, currency_code and timezone are optional and fall back to
 *   environment defaults server-side, so they are deliberately not collected
 *   during signup.
 * - confirm_password is a client-side check only and is never submitted.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import AuthShell, { AuthLink } from "../components/auth/AuthShell";

import { registerUser } from "../services/authService";
import { useAuth } from "../contexts/authContext";

function RegisterPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    company_name: "",
    password: "",
    confirm_password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previousForm) => ({
      ...previousForm,
      [name]: value,
    }));

    if (message) {
      setMessage("");
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    const fullName = form.full_name.trim();
    const email = form.email.trim().toLowerCase();
    const companyName = form.company_name.trim();

    if (!fullName) {
      setMessage("Full name is required.");
      return;
    }

    if (!email) {
      setMessage("Email address is required.");
      return;
    }

    if (!companyName) {
      setMessage("Company name is required.");
      return;
    }

    if (form.password.length < 8) {
      setMessage("Password must contain at least 8 characters.");
      return;
    }

    if (form.password !== form.confirm_password) {
      setMessage("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      /*
       * Exactly the fields the endpoint accepts. No role, no company_id, no
       * company_role, no permission flags: the client cannot request its own
       * privileges, and the backend decides what this account becomes.
       */
      const payload = {
        full_name: fullName,
        email,
        password: form.password,
        company_name: companyName,
      };

      const data = await registerUser(payload);

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      setUser(data.user);

      /*
       * Route on what the SERVER said this account is, never on anything the
       * form asked for. Public signup yields an administrator today, so this
       * resolves to the dashboard; the branch stays general so it keeps
       * agreeing with the backend if that ever changes.
       */
      const userRole = String(data.user?.role || "")
        .trim()
        .toLowerCase();

      if (userRole === "worker") {
        navigate("/worker-portal", { replace: true });
      } else if (userRole === "subcontractor") {
        navigate("/subcontractor-portal", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (error) {
      console.error(
        "Registration failed:",
        error.response?.data || error
      );

      setMessage(
        error.response?.data?.message || "Registration failed."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      /* "Construction Portal Access" named the product a second time and
       * claimed nothing else. The eyebrow now labels the task; the intro
       * states what a workspace actually contains, which is the thing
       * somebody creating one needs to know. */
      eyebrow="New workspace"
      title="Create your workspace"
      intro="A workspace holds one company's tenders, finance, workforce and site records. Nothing is shared with another company."
      heading="Create account"
      subheading="Create your company workspace. You will become its initial administrator."
      footer={<AuthLink to="/login">Back to sign in</AuthLink>}
    >
      <form onSubmit={handleRegister}>
        {/* Feedback above the fields, so it is never below the fold. */}
        {message && (
          <p className="error" role="alert">
            {message}
          </p>
        )}

        {/*
          Three groups, separated by space and a hairline rather than by cards:
          who you are, what the workspace is called, and how you will sign in.
          Grouping gives the same relief as staging without adding navigation
          or breaking password-manager autofill, which reads a whole form.
        */}
        <div className="auth-group">
          <p className="auth-group__label">
            Your details
          </p>

          <div className="auth-field">
            <label htmlFor="register-full-name">Full Name</label>

            <input
              className="field"
              id="register-full-name"
              name="full_name"
              type="text"
              autoComplete="name"
              value={form.full_name}
              placeholder="Full name"
              onChange={handleChange}
              disabled={loading}
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="register-email">Email</label>

            <input
              className="field"
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              placeholder="email@example.com"
              onChange={handleChange}
              disabled={loading}
              required
            />
          </div>
        </div>

        <div className="auth-group">
          <p className="auth-group__label">Your company</p>

          <div className="auth-field">
            <label htmlFor="register-company-name">Company Name</label>

            <input
              className="field"
              id="register-company-name"
              name="company_name"
              type="text"
              autoComplete="organization"
              value={form.company_name}
              placeholder="e.g. Shreeji Construction"
              onChange={handleChange}
              disabled={loading}
              required
            />

            <p className="auth-field__hint">
              This creates a new workspace. To join a company that already
              uses the portal, ask its administrator to add you.
            </p>
          </div>
        </div>

        <div className="auth-group">
          <p className="auth-group__label">Sign-in details</p>

          <div className="auth-field">
            <label htmlFor="register-password">Password</label>

            <div className="password-input-wrapper">
              <input
                className="field"
                id="register-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={form.password}
                placeholder="At least 8 characters"
                onChange={handleChange}
                disabled={loading}
                minLength={8}
                required
              />

              <button
                type="button"
                className="password-toggle-btn ctl ctl--quiet"
                aria-label={
                  showPassword ? "Hide passwords" : "Show passwords"
                }
                aria-pressed={showPassword}
                onClick={() => setShowPassword((previous) => !previous)}
                disabled={loading}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="register-confirm-password">
              Confirm Password
            </label>

            <input
              className="field"
              id="register-confirm-password"
              name="confirm_password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={form.confirm_password}
              placeholder="Confirm password"
              onChange={handleChange}
              disabled={loading}
              minLength={8}
              required
            />
          </div>
        </div>

        <button
            type="submit"
            className="auth-submit ctl ctl--primary ctl--field"
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? "Creating workspace…" : "Create workspace"}
        </button>
      </form>
    </AuthShell>
  );
}

export default RegisterPage;
