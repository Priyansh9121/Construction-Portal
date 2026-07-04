import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../services/authService";
import { useAuth } from "../contexts/AuthContext";

function RegisterPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "worker",
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setMessage("");

      const data = await registerUser(form);

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      setUser(data.user);

      if (data.user.role === "worker") {
        navigate("/worker-portal");
      } else if (data.user.role === "subcontractor") {
        navigate("/subcontractor-portal");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setMessage(err.response?.data?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <section className="login-brand">
        <h1>Create Account</h1>

        <p>
          Register a new account for the construction portal.
        </p>
      </section>

      <section className="login-box">
        <form onSubmit={handleRegister}>
          <h2>Register</h2>

          <label>Full Name</label>
          <input
            name="full_name"
            value={form.full_name}
            placeholder="Full name"
            onChange={handleChange}
            required
          />

          <label>Email</label>
          <input
            name="email"
            type="email"
            value={form.email}
            placeholder="email@example.com"
            onChange={handleChange}
            required
          />

          <label>Password</label>
          <input
            name="password"
            type="password"
            value={form.password}
            placeholder="Create password"
            onChange={handleChange}
            required
          />

          <label>Role</label>
          <select
            name="role"
            value={form.role}
            onChange={handleChange}
          >
            <option value="worker">Worker</option>
            <option value="subcontractor">Subcontractor</option>
            <option value="manager">Manager</option>
          </select>

          <button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Account"}
          </button>

          {message && <p className="error">{message}</p>}

          <div className="login-links">
            <Link to="/login">Back to Login</Link>
          </div>
        </form>
      </section>
    </div>
  );
}

export default RegisterPage;