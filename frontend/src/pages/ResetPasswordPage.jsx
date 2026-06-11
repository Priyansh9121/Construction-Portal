import { useState } from "react";
import { Link } from "react-router-dom";
import { resetPassword } from "../services/userService";

function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const data = await resetPassword({
        token,
        new_password: newPassword,
      });

      setMessage(data.message || "Password reset successfully.");
      setToken("");
      setNewPassword("");
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to reset password.");
    }
  };

  return (
    <div className="login-shell">
      <section className="login-brand">
        <h1>Reset Password</h1>

        <p>Paste your reset token and set a new password.</p>
      </section>

      <section className="login-box">
        <form onSubmit={handleSubmit}>
          <h2>Create New Password</h2>

          <label>Reset Token</label>

          <input
            type="text"
            value={token}
            placeholder="Paste reset token"
            onChange={(e) => setToken(e.target.value)}
            required
          />

          <label>New Password</label>

          <input
            type="password"
            value={newPassword}
            placeholder="Enter new password"
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />

          <button type="submit">Reset Password</button>

          {message && <p className="error">{message}</p>}

          <div className="login-links">
            <Link to="/">Back to Login</Link>
          </div>
        </form>
      </section>
    </div>
  );
}

export default ResetPasswordPage;