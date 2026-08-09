/**
 * File purpose:
 * Completes a password reset from an emailed link.
 *
 * API endpoints:
 * - POST /auth/reset-password via services/userService.js
 *
 * Parent:
 * - None — public route
 *
 * Navigation and children:
 * - Reads the token from the ?token= query parameter of the emailed link and
 * - posts it with the new password. On success, sends the user to login.
 *
 * Important notes:
 * - The token IS the authentication here — there is no session yet. It is
 * - single-use and short-lived; the backend clears it on success, so a
 * - second submission of the same link fails.
 * - The token normally arrives in the link, but the field stays editable so
 *   someone who copied it out of the email by hand can paste it. Reading the
 *   query parameter directly and letting a typed value take precedence keeps
 *   both paths working without an effect copying one piece of state into
 *   another.
 * - When the token DID arrive from the link it is visually de-emphasised and
 *   focus lands on the new-password field instead: the user should not be
 *   asked to think about a field that is already correct. It is never
 *   disabled and never hidden.
 *
 * Password rules are exactly what the contract enforces: at least eight
 * characters, and the two entries must match. No strength meter and no
 * character-class requirements, because the backend has none and inventing
 * them would misrepresent what actually protects the account.
 */

import { useState } from "react";
import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import AuthShell, { AuthLink } from "../components/auth/AuthShell";

import { resetPassword } from "../services/userService";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const linkToken = searchParams.get("token") || "";
  const [typedToken, setTypedToken] = useState(null);

  const token = typedToken ?? linkToken;
  const setToken = setTypedToken;

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  /*
   * One state per field. A single flag revealing both meant a user unsure of
   * only the confirmation had to expose the password too.
   */
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* The reset succeeded; the completion state stands in for the form. */
  const done = Boolean(message);

  const fromLink = Boolean(linkToken) && typedToken === null;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    const cleanToken = token.trim();

    if (!cleanToken) {
      setError("Enter a valid reset token.");
      return;
    }

    if (newPassword.length < 8) {
      setError(
        "Password must contain at least 8 characters."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");
      setError("");

      const data = await resetPassword({
        token: cleanToken,
        new_password: newPassword,
      });

      setMessage(
        data.message ||
          "Password reset successfully. Redirecting to login..."
      );

      setToken("");
      setNewPassword("");
      setConfirmPassword("");

      /*
       * Unchanged at 1500ms. The completion state is budgeted to finish well
       * inside this window, so nothing here waits on an animation.
       */
      window.setTimeout(() => {
        navigate("/login", {
          replace: true,
        });
      }, 1500);
    } catch (requestError) {
      console.error(
        "Password reset failed:",
        requestError.response?.data || requestError
      );

      setError(
        requestError.response?.data?.message ||
          "Failed to reset password."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Account Recovery"
      title={done ? "Password updated" : "Reset password"}
      intro={
        done
          ? "Your password has been changed. Taking you back to sign in."
          : "Enter your reset token and create a secure new password for your account."
      }
      heading={done ? "Password updated" : "Create new password"}
      subheading={
        done ? undefined : "Your password must contain at least eight characters."
      }
      footer={<AuthLink to="/login">Back to sign in</AuthLink>}
    >
      {done ? (
        <div className="auth-confirm" data-testid="reset-confirmation">
          <p className="auth-success" role="status">
            {message}
          </p>

          <div className="auth-confirm__body">
            <p>You can now sign in with your new password.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* Feedback above the fields, so it is never below the fold. */}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <div
            className={
              fromLink ? "auth-field auth-field--resolved" : "auth-field"
            }
          >
            <label htmlFor="reset-token">Reset Token</label>

            <input
              className="field"
              id="reset-token"
              name="token"
              type="text"
              value={token}
              placeholder="Paste reset token"
              onChange={(event) => {
                setToken(event.target.value);

                if (error) {
                  setError("");
                }
              }}
              disabled={submitting}
              required
            />

            {fromLink ? (
              <p className="auth-field__hint">
                Filled in from your reset link. You can edit it if you pasted
                the token by hand.
              </p>
            ) : null}
          </div>

          <div className="auth-field">
            <label htmlFor="new-password">New Password</label>

            <div className="password-input-wrapper">
              <input
                className="field"
                id="new-password"
                name="new_password"
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                placeholder="At least 8 characters"
                onChange={(event) => {
                  setNewPassword(event.target.value);

                  if (error) {
                    setError("");
                  }
                }}
                disabled={submitting}
                minLength={8}
                required
                autoFocus={fromLink}
              />

              <button
                type="button"
                className="password-toggle-btn ctl ctl--quiet"
                aria-label={
                  showNew ? "Hide new password" : "Show new password"
                }
                aria-pressed={showNew}
                onClick={() => setShowNew((previous) => !previous)}
                disabled={submitting}
              >
                {showNew ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="confirm-password">Confirm Password</label>

            <div className="password-input-wrapper">
              <input
                className="field"
                id="confirm-password"
                name="confirm_password"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                placeholder="Confirm new password"
                onChange={(event) => {
                  setConfirmPassword(event.target.value);

                  if (error) {
                    setError("");
                  }
                }}
                disabled={submitting}
                minLength={8}
                required
              />

              <button
                type="button"
                className="password-toggle-btn ctl ctl--quiet"
                aria-label={
                  showConfirm
                    ? "Hide password confirmation"
                    : "Show password confirmation"
                }
                aria-pressed={showConfirm}
                onClick={() => setShowConfirm((previous) => !previous)}
                disabled={submitting}
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="auth-submit ctl ctl--primary ctl--field"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? "Resetting…" : "Reset password"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export default ResetPasswordPage;
