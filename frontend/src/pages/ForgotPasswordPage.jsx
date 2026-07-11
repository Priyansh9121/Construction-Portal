import { useState } from "react";
import { Link } from "react-router-dom";

import { forgotPassword } from "../services/userService";

function ForgotPasswordPage() {
  const [email, setEmail] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [resetToken, setResetToken] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    if (submitting) return;

    const cleanEmail =
      email.trim().toLowerCase();

    if (!cleanEmail) {
      setError(
        "Enter your registered email address."
      );
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");
      setError("");
      setResetToken("");

      const data =
        await forgotPassword({
          email: cleanEmail,
        });

      setMessage(
        data.message ||
          "If the account exists, password reset instructions have been generated."
      );

      if (import.meta.env.DEV) {
        setResetToken(
          data.resetToken || ""
        );
      }
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          "Failed to start password reset."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-shell">
      <section className="login-brand">
        <h1>Forgot Password</h1>

        <p>
          Enter your registered email
          address to reset access to
          your account.
        </p>
      </section>

      <section className="login-box">
        <form
          onSubmit={handleSubmit}
        >
          <h2>Reset Access</h2>

          <p>
            Enter your registered email.
          </p>

          <label htmlFor="reset-email">
            Email
          </label>

          <input
            id="reset-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            placeholder="email@example.com"
            onChange={(event) =>
              setEmail(
                event.target.value
              )
            }
            disabled={submitting}
            required
          />

          <button
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? "Sending..."
              : "Send Reset Instructions"}
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

          {import.meta.env.DEV &&
            resetToken && (
              <div className="reset-token-box">
                <p>
                  Development Reset
                  Token:
                </p>

                <code>
                  {resetToken}
                </code>

                <Link
                  to={`/reset-password?token=${encodeURIComponent(
                    resetToken
                  )}`}
                >
                  Continue to Reset
                  Password
                </Link>
              </div>
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

export default ForgotPasswordPage;