import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../services/userService";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetToken, setResetToken] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const data = await forgotPassword({ email });

      setMessage(data.message || "Reset token generated.");
      setResetToken(data.resetToken || "");
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to generate token.");
      setResetToken("");
    }
  };

  return (
    <div className="login-shell">
      <section className="login-brand">
        <h1>Forgot Password</h1>

        <p>
          Enter your email address and generate a reset token to change your
          password.
        </p>
      </section>

      <section className="login-box">
        <form onSubmit={handleSubmit}>
          <h2>Reset Access</h2>

          <p>Enter your registered email.</p>

          <label>Email</label>

          <input
            type="email"
            value={email}
            placeholder="admin@test.com"
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <button type="submit">Generate Reset Token</button>

          {message && <p className="error">{message}</p>}

          {resetToken && (
            <div className="reset-token-box">
              <p>Reset Token:</p>
              <code>{resetToken}</code>

              <Link to="/reset-password">Go to Reset Password</Link>
            </div>
          )}

          <div className="login-links">
            <Link to="/">Back to Login</Link>
          </div>
        </form>
      </section>
    </div>
  );
}

export default ForgotPasswordPage;