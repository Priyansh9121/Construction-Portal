/**
 * File purpose:
 * Completes a password reset from an emailed link.
 *
 * State:
 * - Local: new password, confirmation, submitting, error.
 *
 * Hooks and context:
 * - None
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
 */

import { useState } from "react";
import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { resetPassword } from "../services/userService";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /*
   * The token normally arrives in the reset link, but the field stays
   * editable so someone who copied it out of the email by hand can paste
   * it. Reading the query parameter directly and letting a typed value
   * take precedence keeps both paths working without an effect that
   * copies one piece of state into another.
   */
  const linkToken = searchParams.get("token") || "";
  const [typedToken, setTypedToken] = useState(null);

  const token = typedToken ?? linkToken;
  const setToken = setTypedToken;

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    <div className="login-shell">
      <section className="login-brand">
        <p className="dashboard-hero-eyebrow">
          Account Recovery
        </p>

        <h1>Reset Password</h1>

        <p>
          Enter your reset token and create a secure new
          password for your account.
        </p>
      </section>

      <section className="login-box">
        <form onSubmit={handleSubmit}>
          <h2>Create New Password</h2>

          <p className="muted-text">
            Your password must contain at least eight
            characters.
          </p>

          <label htmlFor="reset-token">
            Reset Token
          </label>

          <input
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

          <label htmlFor="new-password">
            New Password
          </label>

          <input
            id="new-password"
            name="new_password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={newPassword}
            placeholder="Enter new password"
            onChange={(event) => {
              setNewPassword(event.target.value);

              if (error) {
                setError("");
              }
            }}
            disabled={submitting}
            minLength={8}
            required
          />

          <label htmlFor="confirm-password">
            Confirm Password
          </label>

          <input
            id="confirm-password"
            name="confirm_password"
            type={showPassword ? "text" : "password"}
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

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) =>
                setShowPassword(event.target.checked)
              }
              disabled={submitting}
            />

            Show passwords
          </label>

          <button
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? "Resetting..."
              : "Reset Password"}
          </button>

          {message && (
            <p
              className="success-message"
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

          <div className="login-links">
            <Link to="/login">
              Back to Login
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}

export default ResetPasswordPage;