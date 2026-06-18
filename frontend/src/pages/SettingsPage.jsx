import { useState } from "react";
import { changePassword } from "../services/authService";
import { useAuth } from "../contexts/AuthContext";

function SettingsPage() {
  const { user } = useAuth();

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
  });

  const [companyForm, setCompanyForm] = useState(() => {
    return (
      JSON.parse(localStorage.getItem("companySettings")) || {
        company_name: "",
        abn_gst: "",
        address: "",
        phone: "",
        email: "",
      }
    );
  });

  const [appPrefs, setAppPrefs] = useState(() => {
    return (
      JSON.parse(localStorage.getItem("appPreferences")) || {
        theme: "light",
        default_dashboard: "summary",
        currency: "AUD",
      }
    );
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handlePasswordChange = (e) => {
    setPasswordForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      await changePassword(passwordForm);

      setMessage("Password changed successfully.");
      setPasswordForm({
        current_password: "",
        new_password: "",
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to change password.");
    }
  };

  const handleCompanyChange = (e) => {
    setCompanyForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSaveCompany = (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    localStorage.setItem("companySettings", JSON.stringify(companyForm));
    setMessage("Company details saved locally.");
  };

  const handlePrefsChange = (e) => {
    setAppPrefs((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSavePrefs = (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    localStorage.setItem("appPreferences", JSON.stringify(appPrefs));
    setMessage("App preferences saved locally.");
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Manage your profile, password, company details and app preferences.</p>
        </div>
      </div>

      {message && <p className="success-message">{message}</p>}
      {error && <p className="error">{error}</p>}

      <section className="settings-grid">
        <div className="panel">
          <h2>Profile Details</h2>

          <div className="settings-info-list">
            <div>
              <span>Full Name</span>
              <strong>{user?.full_name || "Not available"}</strong>
            </div>

            <div>
              <span>Email</span>
              <strong>{user?.email || "Not available"}</strong>
            </div>

            <div>
              <span>Role</span>
              <strong>{user?.role || "Not available"}</strong>
            </div>
          </div>
        </div>

        <div className="panel">
          <h2>Change Password</h2>

          <form className="payment-form" onSubmit={handleChangePassword}>
            <input
              type="password"
              name="current_password"
              placeholder="Current password"
              value={passwordForm.current_password}
              onChange={handlePasswordChange}
              required
            />

            <input
              type="password"
              name="new_password"
              placeholder="New password"
              value={passwordForm.new_password}
              onChange={handlePasswordChange}
              required
            />

            <button type="submit">Update Password</button>
          </form>
        </div>

        <div className="panel">
          <h2>Company Details</h2>

          <form className="payment-form" onSubmit={handleSaveCompany}>
            <input
              name="company_name"
              placeholder="Company Name"
              value={companyForm.company_name}
              onChange={handleCompanyChange}
            />

            <input
              name="abn_gst"
              placeholder="ABN / GST Number"
              value={companyForm.abn_gst}
              onChange={handleCompanyChange}
            />

            <input
              name="address"
              placeholder="Company Address"
              value={companyForm.address}
              onChange={handleCompanyChange}
            />

            <input
              name="phone"
              placeholder="Company Phone"
              value={companyForm.phone}
              onChange={handleCompanyChange}
            />

            <input
              name="email"
              placeholder="Company Email"
              value={companyForm.email}
              onChange={handleCompanyChange}
            />

            <button type="submit">Save Company Details</button>
          </form>
        </div>

        <div className="panel">
          <h2>App Preferences</h2>

          <form className="payment-form" onSubmit={handleSavePrefs}>
            <select
              name="theme"
              value={appPrefs.theme}
              onChange={handlePrefsChange}
            >
              <option value="light">Light Theme</option>
              <option value="dark">Dark Theme</option>
            </select>

            <select
              name="default_dashboard"
              value={appPrefs.default_dashboard}
              onChange={handlePrefsChange}
            >
              <option value="summary">Summary Dashboard</option>
              <option value="finance">Finance Dashboard</option>
              <option value="tenders">Tender Dashboard</option>
            </select>

            <select
              name="currency"
              value={appPrefs.currency}
              onChange={handlePrefsChange}
            >
              <option value="AUD">AUD - Australian Dollar</option>
              <option value="INR">INR - Indian Rupee</option>
              <option value="USD">USD - US Dollar</option>
            </select>

            <button type="submit">Save Preferences</button>
          </form>
        </div>
      </section>
    </>
  );
}

export default SettingsPage;