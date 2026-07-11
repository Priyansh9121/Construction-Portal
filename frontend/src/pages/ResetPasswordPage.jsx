import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { resetPassword } from "../services/userService";

function ResetPasswordPage() {
  const navigate = useNavigate();

  const [searchParams] =
    useSearchParams();

  const [token, setToken] =
    useState("");

  const [
    newPassword,
    setNewPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  useEffect(() => {
    const queryToken =
      searchParams.get("token");

    if (queryToken) {
      setToken(queryToken);
    }
  }, [searchParams]);

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    if (submitting) return;

    if (!token.trim()) {
      setError(
        "Enter a valid reset token."
      );
      return;
    }

    if (newPassword.length < 8) {
      setError(
        "Password must contain at least 8 characters."
      );
      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");
      setError("");

      const data =
        await resetPassword({
          token: token.trim(),
          new_password:
            newPassword,
        });

      setMessage(
        data.message ||
          "Password reset successfully."
      );

      setToken("");
      setNewPassword("");
      setConfirmPassword("");

      window.setTimeout(() => {
        navigate(
          "/login",
          {
            replace: true,
          }
        );
      }, 1500);
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          "Failed to reset password."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-shell">
      <section className="login-brand">
        <h1>Reset Password</h1>

        <p>
          Enter your reset token and
          create a new password.
        </p>
      </section>

      <section className="login-box">
        <form
          onSubmit={handleSubmit}
        >
          <h2>Create New Password</h2>

          <label htmlFor="reset-token">
            Reset Token
          </label>

          <input
            id="reset-token"
            type="text"
            value={token}
            placeholder="Paste reset token"
            onChange={(event) =>
              setToken(
                event.target.value
              )
            }
            disabled={submitting}
            required
          />

          <label htmlFor="new-password">
            New Password
          </label>

          <input
            id="new-password"
            type={
              showPassword
                ? "text"
                : "password"
            }
            autoComplete="new-password"
            value={newPassword}
            placeholder="Enter new password"
            onChange={(event) =>
              setNewPassword(
                event.target.value
              )
            }
            disabled={submitting}
            minLength={8}
            required
          />

          <label htmlFor="confirm-password">
            Confirm Password
          </label>

          <input
            id="confirm-password"
            type={
              showPassword
                ? "text"
                : "password"
            }
            autoComplete="new-password"
            value={confirmPassword}
            placeholder="Confirm new password"
            onChange={(event) =>
              setConfirmPassword(
                event.target.value
              )
            }
            disabled={submitting}
            minLength={8}
            required
          />

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) =>
                setShowPassword(
                  event.target.checked
                )
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