/**
 * File purpose:
 * Requests a password-reset link.
 *
 * State:
 * - Local: email, submitting, the confirmation message, the DEV-only token.
 *
 * API endpoints:
 * - POST /auth/forgot-password via services/userService.js
 *
 * Parent:
 * - None — public route
 *
 * ANTI-ENUMERATION IS THE DESIGN CONSTRAINT, NOT AN INCONVENIENCE:
 * The same confirmation is shown whether or not the address is registered,
 * and the backend answers identically for the same reason. Any wording that
 * confirms or denies that an account exists would turn this screen into an
 * oracle for which addresses are registered. There is deliberately no
 * "account not found", no "email not registered", and no "we found your
 * account" anywhere in this file, and there must never be.
 *
 * On success the form is REPLACED by the confirmation rather than sitting
 * above it. Leaving an editable field on screen after a successful request
 * invites the user to submit again, which is both pointless and a way to
 * probe timing differences.
 *
 * Important notes:
 * - The confirmation deliberately says "if an account is eligible". Eligible,
 *   not existing: an address might be registered but disabled, and the copy
 *   must not distinguish those cases either.
 */

import { useState } from "react";
import AuthShell, { AuthLink } from "../components/auth/AuthShell";

import { forgotPassword } from "../services/userService";

/*
 * Styles for the DEV-only reset-token block, loaded only in development.
 *
 * Vite eliminates the DEV-gated JSX from a production build, but CSS is NOT
 * tree-shaken, so when these rules lived in auth.css they shipped as dead
 * bytes to every user. tools/fresh_ui/verify_dev_token_absent.mjs caught it.
 * A dynamic import behind import.meta.env.DEV is dropped entirely, chunk
 * included.
 */
if (import.meta.env.DEV) {
  import("../styles/system/auth/dev-only.css");
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* One request has succeeded, so the form is replaced by the confirmation. */
  const sent = Boolean(message);

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
      eyebrow="Account recovery"
      title={sent ? "Check your email" : "Recover access"}
      intro={
        sent
          ? "Reset instructions are on their way if the account is eligible."
          : /* Facts, not instructions repeated from the subheading. The old
             * line ended "...to your construction portal account", which both
             * named the industry at the user and restated the field label
             * immediately above the field. */
            "A reset link goes to the address on the account. It expires shortly."
      }
      heading={sent ? "Check your email" : "Reset access"}
      subheading={
        sent
          ? undefined
          : "Enter the email address linked to your account and we will send reset instructions."
      }
      footer={<AuthLink to="/login">Back to sign in</AuthLink>}
    >
      {sent ? (
        <div className="auth-confirm" data-testid="forgot-confirmation">
          {/*
            role="status" rather than role="alert": this is a successful
            outcome, announced politely, not an interruption.
          */}
          <p className="auth-success" role="status">
            {message}
          </p>

          <div className="auth-confirm__body">
            <p>
              The link expires shortly, so use it soon. If nothing arrives,
              check your spam folder, then ask your company administrator to
              confirm the address on your account.
            </p>
          </div>

          {import.meta.env.DEV && resetToken ? (
            <div className="auth-devbox" data-testid="dev-reset-token">
              <p className="auth-devbox__label">
                Development only — not shown in production
              </p>

              <code className="auth-devbox__value">{resetToken}</code>

              <AuthLink
                to={`/reset-password?token=${encodeURIComponent(resetToken)}`}
              >
                Continue to reset password
              </AuthLink>
            </div>
          ) : null}
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* Feedback above the field, so it is never below the fold. */}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <div className="auth-field">
            <label htmlFor="forgot-password-email">Email</label>

            <input
              className="field"
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
            className="auth-submit ctl ctl--primary ctl--field"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? "Sending…" : "Send reset instructions"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export default ForgotPasswordPage;
