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
import { Link, useSearchParams } from "react-router-dom";

import AuthShell, { AuthLink } from "../components/auth/AuthShell";
import { describeDestination } from "../utils/authDestinations";

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

  /*
   * Orientation, not navigation.
   *
   * axiosClient writes /login?next=<path> when a session expires mid-task, and
   * App.jsx already decides where sign-in leads. This only reads that value to
   * name the destination, so a user who was bounced can see their place was
   * kept. describeDestination allow-lists exact paths and returns a fixed
   * string from its own table, so the raw parameter is never rendered and an
   * unrecognised value simply shows nothing. No redirect behaviour changes.
   */
  const [searchParams] = useSearchParams();
  const destination = describeDestination(searchParams.get("next"));

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
    <AuthShell
      eyebrow="Secure Construction Management"
      title="Construction Portal"
      intro="Access the projects, finance, workforce and progress tools assigned to your account."
      heading="Sign in"
      subheading={
        destination
          ? `Continue to ${destination}.`
          : "Enter your registered account details."
      }
      aside={
        <div className="auth-brand-list">
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
      }
      footer={
        /*
         * One footer action. "Forgot password?" moved up beside the password
         * label, which leaves account creation as the single remaining
         * alternative rather than two links competing for the same row.
         */
        <AuthLink to="/register">
          Create account
        </AuthLink>
      }
    >
        <form onSubmit={handleSubmit}>
          {/*
            The error sits ABOVE the fields, not below the submit button.
            A failure that renders under a full-width button on a phone is
            frequently below the fold — the user sees nothing happen and
            presses Sign in again. role="alert" announces it either way.
          */}
          {displayedError && (
            <p
              className="error"
              role="alert"
            >
              {displayedError}
            </p>
          )}

          <div className="auth-field">
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
          </div>

          <div className="auth-field">
          {/*
            The recovery link sits with the password label rather than in the
            footer, because that is the moment the user realises they have
            forgotten it. Reading order stays logical: the field is named, then
            its escape hatch, then the control. It is a link rather than a
            field, so it does not interrupt the credential sequence.
          */}
          <div className="auth-field__row">
            <label htmlFor="login-password">
              Password
            </label>

            <Link className="auth-field__action" to="/forgot-password">
              Forgot password?
            </Link>
          </div>

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
          </div>

          <button
            type="submit"
            className="auth-submit"
            disabled={submitting}
          >
            {submitting
              ? "Signing in…"
              : "Sign in"}
          </button>
        </form>
    </AuthShell>
  );
}

export default LoginPage;