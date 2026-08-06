/**
 * File purpose:
 * Requests a password-reset link.
 *
 * State:
 * - Local: email, submitting, whether the request was sent.
 *
 * Hooks and context:
 * - None
 *
 * API endpoints:
 * - POST /auth/forgot-password via services/userService.js
 *
 * Parent:
 * - None — public route
 *
 * Navigation and children:
 * - Always shows the same confirmation, whether or not the address is
 * - registered.
 *
 * Important notes:
 * - That invariant response is deliberate and must be preserved. Showing
 * - 'no such account' here would let anyone enumerate registered addresses.
 * - The backend answers identically for the same reason.
 */

import { useState } from "react";
import AuthShell, { AuthLink } from "../components/auth/AuthShell";

import { forgotPassword } from "../services/userService";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Enter your registered email address.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");
      setError("");
      setResetToken("");

      const data = await forgotPassword({
        email: cleanEmail,
      });

      setMessage(
        data.message ||
          "If the account exists, password reset instructions have been generated."
      );

      // Only expose reset tokens during local development.
      if (import.meta.env.DEV) {
        setResetToken(data.resetToken || "");
      }
    } catch (requestError) {
      console.error(
        "Forgot password request failed:",
        requestError.response?.data || requestError
      );

      setError(
        requestError.response?.data?.message ||
          "Failed to start password reset."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Account Recovery"
      title="Forgot password"
      intro="Enter your registered email address to begin resetting access to your construction portal account."
      heading="Reset access"
      subheading="Enter the email address linked to your account."
      footer={<AuthLink to="/login">Back to sign in</AuthLink>}
    >
        <form onSubmit={handleSubmit}>
          {/* Feedback above the field, so it is never below the fold. */}
          {message && (
            <p
              className="auth-success"
              role="status"
            >
              {message}
            </p>
          )}

          {error && (
            <p
              className="error"
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="auth-field">
          <label htmlFor="forgot-password-email">
            Email
          </label>

          <input
            id="forgot-password-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            placeholder="email@example.com"
            onChange={(event) => {
              setEmail(event.target.value);

              if (error) {
                setError("");
              }
            }}
            disabled={submitting}
            required
          />
          </div>

          <button
            type="submit"
            className="auth-submit"
            disabled={submitting}
          >
            {submitting
              ? "Sending…"
              : "Send reset instructions"}
          </button>

          {import.meta.env.DEV && resetToken && (
            <div className="reset-token-box">
              <p>
                Development Reset Token:
              </p>

              <code>{resetToken}</code>

              <div className="auth-links">
                <AuthLink
                  to={`/reset-password?token=${encodeURIComponent(
                    resetToken
                  )}`}
                >
                  Continue to reset password
                </AuthLink>
              </div>
            </div>
          )}
        </form>
    </AuthShell>
  );
}

export default ForgotPasswordPage;