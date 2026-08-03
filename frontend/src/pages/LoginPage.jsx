/**
 * File purpose:
 * Sign-in screen.
 *
 * State:
 * - Local: email, password, submitting, error message.
 *
 * Hooks and context:
 * - useAuth for setUser after a successful sign-in
 *
 * API endpoints:
 * - POST /auth/login via services/authService.js
 *
 * Parent:
 * - None — a public route, rendered without AppLayout
 *
 * Navigation and children:
 * - On success, stores the token and user through AuthProvider, then sends
 * - the user to their role's home page.
 * - Reads ?next= from the query string so a session that expired mid-task
 * - returns the user where they were; axiosClient sets that parameter.
 *
 * Important notes:
 * - A 401 here is an expected outcome, not an expired session. axiosClient
 * - excludes /auth/login from its sign-out handling precisely so this page
 * - can show 'invalid credentials' instead of being torn down by a reload.
 */

import { useState } from "react";
import { Link } from "react-router-dom";

function LoginPage({
  email,
  setEmail,
  password,
  setPassword,
  message,
  handleLogin,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const cleanEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (!cleanEmail) {
      setLocalError("Enter your email address.");
      return;
    }

    if (!password) {
      setLocalError("Enter your password.");
      return;
    }

    try {
      setSubmitting(true);
      setLocalError("");

      // Keep the controlled email normalised.
      setEmail(cleanEmail);

      await handleLogin(event);
    } catch (error) {
      console.error(
        "Login failed:",
        error.response?.data || error
      );

      setLocalError(
        error.response?.data?.message ||
          error.message ||
          "Unable to log in."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const displayedError =
    localError || message || "";

  return (
    <div className="login-shell">
      <section className="login-brand">
        <p className="dashboard-hero-eyebrow">
          Secure Construction Management
        </p>

        <h1>Construction Portal</h1>

        <p>
          Access the projects, finance, workforce and
          progress tools assigned to your account.
        </p>

        <div className="login-feature-list">
          <div>
            <strong>Administrators</strong>

            <span>
              Manage finance, projects, workers, reports
              and approvals.
            </span>
          </div>

          <div>
            <strong>Workers</strong>

            <span>
              View assigned projects, submit daily
              updates and record expenses.
            </span>
          </div>

          <div>
            <strong>Subcontractors</strong>

            <span>
              Access assigned tenders, documents and
              project progress.
            </span>
          </div>
        </div>
      </section>

      <section className="login-box">
        <form onSubmit={handleSubmit}>
          <h2>Sign In</h2>

          <p className="muted-text">
            Enter your registered account details.
          </p>

          <label htmlFor="login-email">
            Email
          </label>

          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            placeholder="email@example.com"
            onChange={(event) => {
              setEmail(event.target.value);

              if (localError) {
                setLocalError("");
              }
            }}
            disabled={submitting}
            required
          />

          <label htmlFor="login-password">
            Password
          </label>

          <div className="password-input-wrapper">
            <input
              id="login-password"
              name="password"
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              autoComplete="current-password"
              value={password}
              placeholder="Enter your password"
              onChange={(event) => {
                setPassword(event.target.value);

                if (localError) {
                  setLocalError("");
                }
              }}
              disabled={submitting}
              required
            />

            <button
              type="button"
              className="password-toggle-btn"
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
              aria-pressed={showPassword}
              onClick={() =>
                setShowPassword(
                  (previous) => !previous
                )
              }
              disabled={submitting}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? "Signing In..."
              : "Sign In"}
          </button>

          {displayedError && (
            <p
              className="error"
              role="alert"
            >
              {displayedError}
            </p>
          )}

          <div className="login-links">
            <Link to="/forgot-password">
              Forgot Password?
            </Link>

            <Link to="/register">
              Create Account
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}

export default LoginPage;