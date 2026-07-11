import { useState } from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";

import { registerUser } from "../services/authService";
import { useAuth } from "../contexts/AuthContext";

function RegisterPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
    role: "worker",
  });

  const [showPassword, setShowPassword] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const handleChange = (event) => {
    const { name, value } =
      event.target;

    setForm((previousForm) => ({
      ...previousForm,
      [name]: value,
    }));

    if (message) {
      setMessage("");
    }
  };

  const handleRegister = async (
    event
  ) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    const fullName =
      form.full_name.trim();

    const email =
      form.email
        .trim()
        .toLowerCase();

    const role =
      String(form.role || "")
        .trim()
        .toLowerCase();

    if (!fullName) {
      setMessage(
        "Full name is required."
      );
      return;
    }

    if (!email) {
      setMessage(
        "Email address is required."
      );
      return;
    }

    if (form.password.length < 8) {
      setMessage(
        "Password must contain at least 8 characters."
      );
      return;
    }

    if (
      form.password !==
      form.confirm_password
    ) {
      setMessage(
        "Passwords do not match."
      );
      return;
    }

    if (
      ![
        "worker",
        "subcontractor",
      ].includes(role)
    ) {
      setMessage(
        "Select a valid account role."
      );
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const payload = {
        full_name: fullName,
        email,
        password: form.password,
        role,
      };

      const data =
        await registerUser(payload);

      localStorage.setItem(
        "token",
        data.token
      );

      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      setUser(data.user);

      const userRole =
        String(
          data.user?.role || ""
        )
          .trim()
          .toLowerCase();

      if (userRole === "worker") {
        navigate(
          "/worker-portal",
          {
            replace: true,
          }
        );
      } else if (
        userRole ===
        "subcontractor"
      ) {
        navigate(
          "/subcontractor-portal",
          {
            replace: true,
          }
        );
      } else {
        navigate(
          "/dashboard",
          {
            replace: true,
          }
        );
      }
    } catch (error) {
      console.error(
        "Registration failed:",
        error.response?.data || error
      );

      setMessage(
        error.response?.data?.message ||
          "Registration failed."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <section className="login-brand">
        <p className="dashboard-hero-eyebrow">
          Construction Portal Access
        </p>

        <h1>Create Account</h1>

        <p>
          Register as a worker or
          subcontractor to access
          assignments, site updates and
          project information.
        </p>
      </section>

      <section className="login-box">
        <form
          onSubmit={handleRegister}
        >
          <h2>Register</h2>

          <p className="muted-text">
            Enter your account details.
          </p>

          <label htmlFor="register-full-name">
            Full Name
          </label>

          <input
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

          <label htmlFor="register-email">
            Email
          </label>

          <input
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

          <label htmlFor="register-password">
            Password
          </label>

          <div className="password-input-wrapper">
            <input
              id="register-password"
              name="password"
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              autoComplete="new-password"
              value={form.password}
              placeholder="Create password"
              onChange={handleChange}
              disabled={loading}
              minLength={8}
              required
            />

            <button
              type="button"
              className="password-toggle-btn"
              aria-label={
                showPassword
                  ? "Hide passwords"
                  : "Show passwords"
              }
              aria-pressed={showPassword}
              onClick={() =>
                setShowPassword(
                  (previous) =>
                    !previous
                )
              }
              disabled={loading}
            >
              {showPassword
                ? "Hide"
                : "Show"}
            </button>
          </div>

          <label htmlFor="register-confirm-password">
            Confirm Password
          </label>

          <input
            id="register-confirm-password"
            name="confirm_password"
            type={
              showPassword
                ? "text"
                : "password"
            }
            autoComplete="new-password"
            value={
              form.confirm_password
            }
            placeholder="Confirm password"
            onChange={handleChange}
            disabled={loading}
            minLength={8}
            required
          />

          <label htmlFor="register-role">
            Role
          </label>

          <select
            id="register-role"
            name="role"
            value={form.role}
            onChange={handleChange}
            disabled={loading}
            required
          >
            <option value="worker">
              Worker
            </option>

            <option value="subcontractor">
              Subcontractor
            </option>
          </select>

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Creating..."
              : "Create Account"}
          </button>

          {message && (
            <p
              className="error"
              role="alert"
            >
              {message}
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

export default RegisterPage;