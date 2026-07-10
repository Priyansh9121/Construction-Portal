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

    if (submitting) return;

    const cleanEmail = String(email || "").trim();

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

      await handleLogin(event);
    } catch (error) {
      setLocalError(
        error?.response?.data?.message ||
          error?.message ||
          "Unable to log in."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-shell">
      <section className="login-brand">
        <p className="dashboard-hero-eyebrow">
          Secure Construction Management
        </p>

        <h1>Construction Portal</h1>

        <p>
          Access the tools and projects assigned to your account.
          Administrators manage company operations, while workers and
          subcontractors see only their own work.
        </p>

        <div className="login-feature-list">
          <div>
            <strong>Administrators</strong>
            <span>
              Finance, projects, workforce, reports and approvals.
            </span>
          </div>

          <div>
            <strong>Workers</strong>
            <span>
              Assigned projects, daily updates and expenses.
            </span>
          </div>

          <div>
            <strong>Subcontractors</strong>
            <span>
              Assigned tenders, documents and site progress.
            </span>
          </div>
        </div>
      </section>

      <section className="login-box">
        <form onSubmit={handleSubmit}>
          <div>
            <p className="muted-text">Welcome back</p>
            <h2>Log in</h2>

            <p>
              Enter your account details to continue to your portal.
            </p>
          </div>

          <label htmlFor="login-email">
            Email Address
          </label>

          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            placeholder="name@example.com"
            onChange={(event) => {
              setEmail(event.target.value);
              setLocalError("");
            }}
            required
          />

          <label htmlFor="login-password">
            Password
          </label>

          <div className="password-input-row">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              placeholder="Enter your password"
              onChange={(event) => {
                setPassword(event.target.value);
                setLocalError("");
              }}
              required
            />

            <button
              type="button"
              className="password-toggle-button"
              onClick={() =>
                setShowPassword((current) => !current)
              }
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {(localError || message) && (
            <p className="error">
              {localError || message}
            </p>
          )}

          <button type="submit" disabled={submitting}>
            {submitting ? "Logging in..." : "Login to Portal"}
          </button>

          <div className="login-links">
            <Link to="/forgot-password">
              Forgot Password?
            </Link>

            <Link to="/register">
              Create Account
            </Link>
          </div>

          <small className="muted-text">
            You will automatically be taken to the portal permitted
            for your account role.
          </small>
        </form>
      </section>
    </div>
  );
}

export default LoginPage;