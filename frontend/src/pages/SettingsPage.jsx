import { useRef, useState } from "react";
import toast from "react-hot-toast";

import { changePassword } from "../services/authService";
import { useAuth } from "../contexts/AuthContext";
import ExportButtons from "../components/export/ExportButtons";

const DEFAULT_COMPANY_SETTINGS = {
  company_name: "",
  abn_gst: "",
  business_registration: "",
  address: "",
  suburb_city: "",
  state: "",
  postal_code: "",
  country: "India",
  phone: "",
  email: "",
  website: "",
  default_bank: "",
};

const DEFAULT_APP_PREFERENCES = {
  theme: "light",
  default_dashboard: "summary",
  currency: "INR",
  date_format: "DD/MM/YYYY",
  rows_per_page: "10",
  default_payment_mode: "Bank",
  default_date_filter: "all",
  animations_enabled: true,
  auto_save_enabled: true,
  dashboard_tips_enabled: true,
};

const DEFAULT_CONSTRUCTION_SETTINGS = {
  gst_percent: "18",
  company_charge_percent: "2",
  invoice_due_days: "30",
  financial_year_start: "April",
};

const DEFAULT_EXPORT_SETTINGS = {
  report_footer: "Generated from Construction Portal",
  watermark: "",
  paper_size: "A4",
  orientation: "landscape",
  include_signature: true,
  include_timestamp: true,
  include_company_details: true,
  include_confidential_label: true,
};

const CURRENCY_OPTIONS = [
  {
    value: "INR",
    label: "INR — Indian Rupee",
    symbol: "₹",
  },
  {
    value: "AUD",
    label: "AUD — Australian Dollar",
    symbol: "$",
  },
  {
    value: "USD",
    label: "USD — US Dollar",
    symbol: "$",
  },
  {
    value: "GBP",
    label: "GBP — British Pound",
    symbol: "£",
  },
  {
    value: "EUR",
    label: "EUR — Euro",
    symbol: "€",
  },
  {
    value: "CAD",
    label: "CAD — Canadian Dollar",
    symbol: "$",
  },
  {
    value: "NZD",
    label: "NZD — New Zealand Dollar",
    symbol: "$",
  },
  {
    value: "AED",
    label: "AED — UAE Dirham",
    symbol: "د.إ",
  },
  {
    value: "SGD",
    label: "SGD — Singapore Dollar",
    symbol: "$",
  },
  {
    value: "JPY",
    label: "JPY — Japanese Yen",
    symbol: "¥",
  },
];

const SETTINGS_SECTIONS = [
  {
    key: "company",
    label: "Company",
  },
  {
    key: "construction",
    label: "Construction Defaults",
  },
  {
    key: "preferences",
    label: "Preferences",
  },
  {
    key: "exports",
    label: "Export Settings",
  },
  {
    key: "security",
    label: "Security",
  },
  {
    key: "data",
    label: "Data & Backup",
  },
  {
    key: "about",
    label: "About",
  },
];

function readStoredSettings(key, fallback) {
  try {
    const storedValue = localStorage.getItem(key);

    if (!storedValue) {
      return fallback;
    }

    const parsedValue = JSON.parse(storedValue);

    return {
      ...fallback,
      ...(parsedValue || {}),
    };
  } catch {
    return fallback;
  }
}

function SettingsPage() {
  const { user } = useAuth();
  const backupInputRef = useRef(null);

  const [activeSection, setActiveSection] =
    useState("company");

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [showPasswords, setShowPasswords] =
    useState(false);

  const [
    passwordSubmitting,
    setPasswordSubmitting,
  ] = useState(false);

  const [companyForm, setCompanyForm] = useState(() =>
    readStoredSettings(
      "companySettings",
      DEFAULT_COMPANY_SETTINGS
    )
  );

  const [appPrefs, setAppPrefs] = useState(() =>
    readStoredSettings(
      "appPreferences",
      DEFAULT_APP_PREFERENCES
    )
  );

  const [
    constructionSettings,
    setConstructionSettings,
  ] = useState(() =>
    readStoredSettings(
      "constructionSettings",
      DEFAULT_CONSTRUCTION_SETTINGS
    )
  );

  const [exportSettings, setExportSettings] =
    useState(() =>
      readStoredSettings(
        "exportSettings",
        DEFAULT_EXPORT_SETTINGS
      )
    );

  const selectedCurrency =
    CURRENCY_OPTIONS.find(
      (currency) =>
        currency.value === appPrefs.currency
    ) || CURRENCY_OPTIONS[0];

  const passwordStrength = (() => {
    const password = passwordForm.new_password;

    if (!password) return 0;

    let strength = 0;

    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;

    return strength;
  })();

  const passwordStrengthLabel = [
    "Not entered",
    "Very weak",
    "Weak",
    "Fair",
    "Good",
    "Strong",
  ][passwordStrength];

  const saveLocalSettings = (
    key,
    value,
    successMessage
  ) => {
    try {
      localStorage.setItem(
        key,
        JSON.stringify(value)
      );

      toast.success(successMessage);
    } catch (error) {
      console.error(
        "Failed to save settings:",
        error
      );

      toast.error(
        "Failed to save settings in this browser."
      );
    }
  };

  const handleCompanyChange = (event) => {
    const { name, value } = event.target;

    setCompanyForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handlePreferenceChange = (event) => {
    const {
      name,
      type,
      checked,
      value,
    } = event.target;

    setAppPrefs((previous) => ({
      ...previous,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  };

  const handleConstructionChange = (event) => {
    const { name, value } = event.target;

    setConstructionSettings((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleExportChange = (event) => {
    const {
      name,
      type,
      checked,
      value,
    } = event.target;

    setExportSettings((previous) => ({
      ...previous,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;

    setPasswordForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSaveCompany = (event) => {
    event.preventDefault();

    const cleanCompany = {
      ...companyForm,
      company_name:
        companyForm.company_name.trim(),
      abn_gst:
        companyForm.abn_gst.trim(),
      business_registration:
        companyForm.business_registration.trim(),
      address:
        companyForm.address.trim(),
      suburb_city:
        companyForm.suburb_city.trim(),
      state:
        companyForm.state.trim(),
      postal_code:
        companyForm.postal_code.trim(),
      phone:
        companyForm.phone.trim(),
      email:
        companyForm.email.trim(),
      website:
        companyForm.website.trim(),
      default_bank:
        companyForm.default_bank.trim(),
    };

    setCompanyForm(cleanCompany);

    saveLocalSettings(
      "companySettings",
      cleanCompany,
      "Company details saved successfully."
    );
  };

  const handleSavePreferences = (event) => {
    event.preventDefault();

    saveLocalSettings(
      "appPreferences",
      appPrefs,
      "Application preferences saved successfully."
    );
  };

  const handleSaveConstructionSettings = (
    event
  ) => {
    event.preventDefault();

    const gstPercent = Number(
      constructionSettings.gst_percent || 0
    );

    const companyChargePercent = Number(
      constructionSettings.company_charge_percent ||
        0
    );

    const invoiceDueDays = Number(
      constructionSettings.invoice_due_days ||
        0
    );

    if (gstPercent < 0) {
      toast.error(
        "GST percentage cannot be negative."
      );
      return;
    }

    if (companyChargePercent < 0) {
      toast.error(
        "Company charge percentage cannot be negative."
      );
      return;
    }

    if (invoiceDueDays < 0) {
      toast.error(
        "Invoice due days cannot be negative."
      );
      return;
    }

    saveLocalSettings(
      "constructionSettings",
      constructionSettings,
      "Construction defaults saved successfully."
    );
  };

  const handleSaveExportSettings = (
    event
  ) => {
    event.preventDefault();

    saveLocalSettings(
      "exportSettings",
      exportSettings,
      "Export settings saved successfully."
    );
  };

  const handleChangePassword = async (
    event
  ) => {
    event.preventDefault();

    if (passwordSubmitting) return;

    if (!passwordForm.current_password) {
      toast.error(
        "Enter your current password."
      );
      return;
    }

    if (
      passwordForm.new_password.length < 8
    ) {
      toast.error(
        "New password must contain at least 8 characters."
      );
      return;
    }

    if (
      passwordForm.new_password !==
      passwordForm.confirm_password
    ) {
      toast.error(
        "New password and confirmation do not match."
      );
      return;
    }

    try {
      setPasswordSubmitting(true);

      await changePassword({
        current_password:
          passwordForm.current_password,
        new_password:
          passwordForm.new_password,
      });

      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });

      toast.success(
        "Password changed successfully."
      );
    } catch (error) {
      console.error(
        "Failed to change password:",
        error.response?.data || error
      );

      toast.error(
        error.response?.data?.message ||
          "Failed to change password."
      );
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleDownloadBackup = () => {
    try {
      const backup = {
        version: "1.0.0",
        exported_at:
          new Date().toISOString(),
        companySettings: companyForm,
        appPreferences: appPrefs,
        constructionSettings,
        exportSettings,
      };

      const blob = new Blob(
        [
          JSON.stringify(
            backup,
            null,
            2
          ),
        ],
        {
          type: "application/json",
        }
      );

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;
      link.download = `construction-portal-settings-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      toast.success(
        "Settings backup downloaded."
      );
    } catch (error) {
      console.error(
        "Failed to download backup:",
        error
      );

      toast.error(
        "Failed to download settings backup."
      );
    }
  };

  const handleBackupImport = async (
    event
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) return;

    try {
      const fileContent =
        await file.text();

      const backup =
        JSON.parse(fileContent);

      const restoredCompany = {
        ...DEFAULT_COMPANY_SETTINGS,
        ...(backup.companySettings ||
          {}),
      };

      const restoredPreferences = {
        ...DEFAULT_APP_PREFERENCES,
        ...(backup.appPreferences ||
          {}),
      };

      const restoredConstruction = {
        ...DEFAULT_CONSTRUCTION_SETTINGS,
        ...(backup.constructionSettings ||
          {}),
      };

      const restoredExport = {
        ...DEFAULT_EXPORT_SETTINGS,
        ...(backup.exportSettings ||
          {}),
      };

      setCompanyForm(
        restoredCompany
      );

      setAppPrefs(
        restoredPreferences
      );

      setConstructionSettings(
        restoredConstruction
      );

      setExportSettings(
        restoredExport
      );

      localStorage.setItem(
        "companySettings",
        JSON.stringify(
          restoredCompany
        )
      );

      localStorage.setItem(
        "appPreferences",
        JSON.stringify(
          restoredPreferences
        )
      );

      localStorage.setItem(
        "constructionSettings",
        JSON.stringify(
          restoredConstruction
        )
      );

      localStorage.setItem(
        "exportSettings",
        JSON.stringify(
          restoredExport
        )
      );

      toast.success(
        "Settings backup restored successfully."
      );
    } catch (error) {
      console.error(
        "Failed to restore backup:",
        error
      );

      toast.error(
        "The selected backup file is invalid."
      );
    } finally {
      event.target.value = "";
    }
  };

  const handleResetLocalSettings = () => {
    const confirmed =
      window.confirm(
        "Reset company, construction, export and application settings?"
      );

    if (!confirmed) return;

    setCompanyForm({
      ...DEFAULT_COMPANY_SETTINGS,
    });

    setAppPrefs({
      ...DEFAULT_APP_PREFERENCES,
    });

    setConstructionSettings({
      ...DEFAULT_CONSTRUCTION_SETTINGS,
    });

    setExportSettings({
      ...DEFAULT_EXPORT_SETTINGS,
    });

    localStorage.removeItem(
      "companySettings"
    );

    localStorage.removeItem(
      "appPreferences"
    );

    localStorage.removeItem(
      "constructionSettings"
    );

    localStorage.removeItem(
      "exportSettings"
    );

    toast.success(
      "Local settings were reset."
    );
  };

  const settingsExportRows = [
    {
      category: "Company",
      setting: "Company Name",
      value:
        companyForm.company_name ||
        "",
    },
    {
      category: "Company",
      setting: "ABN / GST",
      value:
        companyForm.abn_gst || "",
    },
    {
      category: "Company",
      setting: "Country",
      value:
        companyForm.country || "",
    },
    {
      category: "Application",
      setting: "Theme",
      value: appPrefs.theme,
    },
    {
      category: "Application",
      setting: "Currency",
      value: appPrefs.currency,
    },
    {
      category: "Application",
      setting: "Date Format",
      value: appPrefs.date_format,
    },
    {
      category: "Construction",
      setting: "GST Percentage",
      value: `${constructionSettings.gst_percent}%`,
    },
    {
      category: "Construction",
      setting: "Company Charge",
      value: `${constructionSettings.company_charge_percent}%`,
    },
    {
      category: "Construction",
      setting: "Invoice Due Days",
      value:
        constructionSettings.invoice_due_days,
    },
    {
      category: "Export",
      setting: "Paper Size",
      value:
        exportSettings.paper_size,
    },
    {
      category: "Export",
      setting: "Orientation",
      value:
        exportSettings.orientation,
    },
  ];

  const settingsExportColumns = [
    {
      key: "category",
      label: "Category",
    },
    {
      key: "setting",
      label: "Setting",
    },
    {
      key: "value",
      label: "Value",
    },
  ];

  const settingsExportSummary = {
    Company:
      companyForm.company_name ||
      "Not configured",
    Currency: appPrefs.currency,
    Theme: appPrefs.theme,
    "GST Percentage": `${constructionSettings.gst_percent}%`,
    "Company Charge": `${constructionSettings.company_charge_percent}%`,
    "PDF Paper Size":
      exportSettings.paper_size,
    "PDF Orientation":
      exportSettings.orientation,
  };

  return (
    <>
      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Settings</h2>

            <p className="muted-text">
              Manage company branding, construction defaults,
              exports, security and portal preferences.
            </p>
          </div>

          <ExportButtons
            filename="construction-portal-settings"
            title="Construction Portal Settings"
            subtitle="Company and application configuration report"
            rows={settingsExportRows}
            columns={settingsExportColumns}
            summary={settingsExportSummary}
          />
        </div>
      </section>

      <section className="summary-cards">
        <div className="card">
          <p>Company</p>
          <h2>
            {companyForm.company_name ||
              "Not configured"}
          </h2>
        </div>

        <div className="card">
          <p>Currency</p>
          <h2>
            {selectedCurrency.symbol}{" "}
            {appPrefs.currency}
          </h2>
        </div>

        <div className="card">
          <p>Theme</p>
          <h2>{appPrefs.theme}</h2>
        </div>

        <div className="card">
          <p>GST</p>
          <h2>
            {
              constructionSettings.gst_percent
            }
            %
          </h2>
        </div>

        <div className="card">
          <p>Company Charge</p>
          <h2>
            {
              constructionSettings.company_charge_percent
            }
            %
          </h2>
        </div>

        <div className="card">
          <p>Current Role</p>
          <h2>
            {user?.role ||
              "Not available"}
          </h2>
        </div>

        <div className="card">
          <p>Dashboard</p>
          <h2>
            {appPrefs.default_dashboard}
          </h2>
        </div>

        <div className="card">
          <p>PDF Format</p>
          <h2>
            {exportSettings.paper_size} ·{" "}
            {exportSettings.orientation}
          </h2>
        </div>
      </section>

      <section className="panel">
        <div className="tabs">
          {SETTINGS_SECTIONS.map(
            (section) => (
              <button
                key={section.key}
                type="button"
                className={
                  activeSection ===
                  section.key
                    ? "active-tab"
                    : ""
                }
                onClick={() =>
                  setActiveSection(
                    section.key
                  )
                }
              >
                {section.label}
              </button>
            )
          )}
        </div>
      </section>

      {activeSection === "company" && (
        <section className="settings-grid">
          <div className="panel">
            <div className="section-title-row">
              <div>
                <h2>Company Profile</h2>

                <p className="muted-text">
                  These details are used in professional PDF
                  and Excel exports.
                </p>
              </div>
            </div>

            <form
              className="payment-form"
              onSubmit={
                handleSaveCompany
              }
            >
              <div className="form-section-title">
                <h3>
                  Business Identity
                </h3>

                <p className="muted-text">
                  Legal and customer-facing company information.
                </p>
              </div>

              <div className="form-grid">
                <label>
                  Company Name
                  <input
                    name="company_name"
                    value={
                      companyForm.company_name
                    }
                    onChange={
                      handleCompanyChange
                    }
                    required
                  />
                </label>

                <label>
                  ABN / GST Number
                  <input
                    name="abn_gst"
                    value={
                      companyForm.abn_gst
                    }
                    onChange={
                      handleCompanyChange
                    }
                  />
                </label>

                <label>
                  Business Registration
                  <input
                    name="business_registration"
                    value={
                      companyForm.business_registration
                    }
                    onChange={
                      handleCompanyChange
                    }
                  />
                </label>

                <label>
                  Website
                  <input
                    name="website"
                    type="url"
                    placeholder="https://example.com"
                    value={
                      companyForm.website
                    }
                    onChange={
                      handleCompanyChange
                    }
                  />
                </label>

                <label>
                  Company Phone
                  <input
                    name="phone"
                    type="tel"
                    value={
                      companyForm.phone
                    }
                    onChange={
                      handleCompanyChange
                    }
                  />
                </label>

                <label>
                  Company Email
                  <input
                    name="email"
                    type="email"
                    value={
                      companyForm.email
                    }
                    onChange={
                      handleCompanyChange
                    }
                  />
                </label>

                <label>
                  Default Bank
                  <input
                    name="default_bank"
                    value={
                      companyForm.default_bank
                    }
                    onChange={
                      handleCompanyChange
                    }
                  />
                </label>
              </div>

              <div className="form-section-title">
                <h3>
                  Business Address
                </h3>
              </div>

              <label>
                Street Address
                <textarea
                  name="address"
                  value={
                    companyForm.address
                  }
                  onChange={
                    handleCompanyChange
                  }
                />
              </label>

              <div className="form-grid">
                <label>
                  Suburb / City
                  <input
                    name="suburb_city"
                    value={
                      companyForm.suburb_city
                    }
                    onChange={
                      handleCompanyChange
                    }
                  />
                </label>

                <label>
                  State
                  <input
                    name="state"
                    value={
                      companyForm.state
                    }
                    onChange={
                      handleCompanyChange
                    }
                  />
                </label>

                <label>
                  Postal Code
                  <input
                    name="postal_code"
                    value={
                      companyForm.postal_code
                    }
                    onChange={
                      handleCompanyChange
                    }
                  />
                </label>

                <label>
                  Country
                  <select
                    name="country"
                    value={
                      companyForm.country
                    }
                    onChange={
                      handleCompanyChange
                    }
                  >
                    <option value="India">
                      India
                    </option>
                    <option value="Australia">
                      Australia
                    </option>
                    <option value="New Zealand">
                      New Zealand
                    </option>
                    <option value="United States">
                      United States
                    </option>
                    <option value="United Kingdom">
                      United Kingdom
                    </option>
                    <option value="United Arab Emirates">
                      United Arab Emirates
                    </option>
                    <option value="Singapore">
                      Singapore
                    </option>
                    <option value="Canada">
                      Canada
                    </option>
                  </select>
                </label>
              </div>

              <div className="form-preview-total">
                Export Header Preview:{" "}
                {companyForm.company_name ||
                  "Construction Portal"}{" "}
                ·{" "}
                {companyForm.abn_gst ||
                  "No registration number"}{" "}
                · {companyForm.country}
              </div>

              <button type="submit">
                Save Company Profile
              </button>
            </form>
          </div>

          <div className="panel">
            <h2>
              Current User Profile
            </h2>

            <div className="settings-info-list">
              <div>
                <span>Full Name</span>
                <strong>
                  {user?.full_name ||
                    "Not available"}
                </strong>
              </div>

              <div>
                <span>Email</span>
                <strong>
                  {user?.email ||
                    "Not available"}
                </strong>
              </div>

              <div>
                <span>Role</span>
                <strong>
                  {user?.role ||
                    "Not available"}
                </strong>
              </div>

              <div>
                <span>Company</span>
                <strong>
                  {companyForm.company_name ||
                    "Not configured"}
                </strong>
              </div>

              <div>
                <span>
                  Default Currency
                </span>
                <strong>
                  {
                    selectedCurrency.label
                  }
                </strong>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeSection ===
        "construction" && (
        <section className="payment-grid">
          <div className="panel">
            <h2>
              Construction Defaults
            </h2>

            <form
              className="payment-form"
              onSubmit={
                handleSaveConstructionSettings
              }
            >
              <div className="form-grid">
                <label>
                  Default GST Percentage
                  <input
                    name="gst_percent"
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      constructionSettings.gst_percent
                    }
                    onChange={
                      handleConstructionChange
                    }
                  />
                </label>

                <label>
                  Default Company Charge Percentage
                  <input
                    name="company_charge_percent"
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      constructionSettings.company_charge_percent
                    }
                    onChange={
                      handleConstructionChange
                    }
                  />
                </label>

                <label>
                  Default Invoice Due Days
                  <input
                    name="invoice_due_days"
                    type="number"
                    min="0"
                    value={
                      constructionSettings.invoice_due_days
                    }
                    onChange={
                      handleConstructionChange
                    }
                  />
                </label>

                <label>
                  Financial Year Start
                  <select
                    name="financial_year_start"
                    value={
                      constructionSettings.financial_year_start
                    }
                    onChange={
                      handleConstructionChange
                    }
                  >
                    <option value="January">
                      January
                    </option>
                    <option value="April">
                      April
                    </option>
                    <option value="July">
                      July
                    </option>
                  </select>
                </label>
              </div>

              <button type="submit">
                Save Construction Defaults
              </button>
            </form>
          </div>

          <div className="panel">
            <h2>Current Defaults</h2>

            <table>
              <tbody>
                <tr>
                  <td>Currency</td>
                  <td>
                    {
                      selectedCurrency.label
                    }
                  </td>
                </tr>

                <tr>
                  <td>GST</td>
                  <td>
                    {
                      constructionSettings.gst_percent
                    }
                    %
                  </td>
                </tr>

                <tr>
                  <td>
                    Company Charge
                  </td>
                  <td>
                    {
                      constructionSettings.company_charge_percent
                    }
                    %
                  </td>
                </tr>

                <tr>
                  <td>Invoice Terms</td>
                  <td>
                    {
                      constructionSettings.invoice_due_days
                    }{" "}
                    days
                  </td>
                </tr>

                <tr>
                  <td>
                    Financial Year
                  </td>
                  <td>
                    Starts in{" "}
                    {
                      constructionSettings.financial_year_start
                    }
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeSection ===
        "preferences" && (
        <section className="payment-grid">
          <div className="panel">
            <h2>
              Application Preferences
            </h2>

            <form
              className="payment-form"
              onSubmit={
                handleSavePreferences
              }
            >
              <div className="form-grid">
                <label>
                  Theme
                  <select
                    name="theme"
                    value={appPrefs.theme}
                    onChange={
                      handlePreferenceChange
                    }
                  >
                    <option value="light">
                      Light Theme
                    </option>
                    <option value="dark">
                      Dark Theme
                    </option>
                    <option value="system">
                      Follow System
                    </option>
                  </select>
                </label>

                <label>
                  Default Dashboard
                  <select
                    name="default_dashboard"
                    value={
                      appPrefs.default_dashboard
                    }
                    onChange={
                      handlePreferenceChange
                    }
                  >
                    <option value="summary">
                      Summary Dashboard
                    </option>
                    <option value="finance">
                      Finance Dashboard
                    </option>
                    <option value="tenders">
                      Tender Dashboard
                    </option>
                  </select>
                </label>

                <label>
                  Currency
                  <select
                    name="currency"
                    value={appPrefs.currency}
                    onChange={
                      handlePreferenceChange
                    }
                  >
                    {CURRENCY_OPTIONS.map(
                      (currency) => (
                        <option
                          key={
                            currency.value
                          }
                          value={
                            currency.value
                          }
                        >
                          {
                            currency.label
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  Date Format
                  <select
                    name="date_format"
                    value={
                      appPrefs.date_format
                    }
                    onChange={
                      handlePreferenceChange
                    }
                  >
                    <option value="DD/MM/YYYY">
                      DD/MM/YYYY
                    </option>
                    <option value="MM/DD/YYYY">
                      MM/DD/YYYY
                    </option>
                    <option value="YYYY-MM-DD">
                      YYYY-MM-DD
                    </option>
                  </select>
                </label>

                <label>
                  Rows Per Table
                  <select
                    name="rows_per_page"
                    value={
                      appPrefs.rows_per_page
                    }
                    onChange={
                      handlePreferenceChange
                    }
                  >
                    <option value="10">
                      10 rows
                    </option>
                    <option value="20">
                      20 rows
                    </option>
                    <option value="50">
                      50 rows
                    </option>
                    <option value="100">
                      100 rows
                    </option>
                  </select>
                </label>

                <label>
                  Default Payment Mode
                  <select
                    name="default_payment_mode"
                    value={
                      appPrefs.default_payment_mode
                    }
                    onChange={
                      handlePreferenceChange
                    }
                  >
                    <option value="Bank">
                      Bank
                    </option>
                    <option value="Cash">
                      Cash
                    </option>
                    <option value="Cheque">
                      Cheque
                    </option>
                    <option value="UPI">
                      UPI
                    </option>
                  </select>
                </label>

                <label>
                  Default Date Filter
                  <select
                    name="default_date_filter"
                    value={
                      appPrefs.default_date_filter
                    }
                    onChange={
                      handlePreferenceChange
                    }
                  >
                    <option value="all">
                      All Records
                    </option>
                    <option value="today">
                      Today
                    </option>
                    <option value="month">
                      Current Month
                    </option>
                    <option value="year">
                      Current Year
                    </option>
                  </select>
                </label>
              </div>

              <div className="settings-toggle-list">
                <label>
                  <input
                    type="checkbox"
                    name="animations_enabled"
                    checked={
                      appPrefs.animations_enabled
                    }
                    onChange={
                      handlePreferenceChange
                    }
                  />
                  Enable interface animations
                </label>

                <label>
                  <input
                    type="checkbox"
                    name="auto_save_enabled"
                    checked={
                      appPrefs.auto_save_enabled
                    }
                    onChange={
                      handlePreferenceChange
                    }
                  />
                  Enable draft auto-save
                </label>

                <label>
                  <input
                    type="checkbox"
                    name="dashboard_tips_enabled"
                    checked={
                      appPrefs.dashboard_tips_enabled
                    }
                    onChange={
                      handlePreferenceChange
                    }
                  />
                  Show dashboard recommendations
                </label>
              </div>

              <button type="submit">
                Save Application Preferences
              </button>
            </form>
          </div>

          <div className="panel">
            <h2>
              Preference Preview
            </h2>

            <table>
              <tbody>
                <tr>
                  <td>Theme</td>
                  <td>
                    {appPrefs.theme}
                  </td>
                </tr>

                <tr>
                  <td>Currency</td>
                  <td>
                    {
                      selectedCurrency.symbol
                    }{" "}
                    {
                      selectedCurrency.label
                    }
                  </td>
                </tr>

                <tr>
                  <td>Date Format</td>
                  <td>
                    {
                      appPrefs.date_format
                    }
                  </td>
                </tr>

                <tr>
                  <td>Table Size</td>
                  <td>
                    {
                      appPrefs.rows_per_page
                    }{" "}
                    rows
                  </td>
                </tr>

                <tr>
                  <td>
                    Payment Mode
                  </td>
                  <td>
                    {
                      appPrefs.default_payment_mode
                    }
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeSection === "exports" && (
        <section className="payment-grid">
          <div className="panel">
            <h2>Export Settings</h2>

            <form
              className="payment-form"
              onSubmit={
                handleSaveExportSettings
              }
            >
              <label>
                Report Footer
                <input
                  name="report_footer"
                  value={
                    exportSettings.report_footer
                  }
                  onChange={
                    handleExportChange
                  }
                />
              </label>

              <label>
                Watermark
                <input
                  name="watermark"
                  placeholder="Example: DRAFT or CONFIDENTIAL"
                  value={
                    exportSettings.watermark
                  }
                  onChange={
                    handleExportChange
                  }
                />
              </label>

              <div className="form-grid">
                <label>
                  PDF Paper Size
                  <select
                    name="paper_size"
                    value={
                      exportSettings.paper_size
                    }
                    onChange={
                      handleExportChange
                    }
                  >
                    <option value="A4">
                      A4
                    </option>
                    <option value="A3">
                      A3
                    </option>
                    <option value="Letter">
                      Letter
                    </option>
                  </select>
                </label>

                <label>
                  PDF Orientation
                  <select
                    name="orientation"
                    value={
                      exportSettings.orientation
                    }
                    onChange={
                      handleExportChange
                    }
                  >
                    <option value="landscape">
                      Landscape
                    </option>
                    <option value="portrait">
                      Portrait
                    </option>
                  </select>
                </label>
              </div>

              <div className="settings-toggle-list">
                <label>
                  <input
                    type="checkbox"
                    name="include_company_details"
                    checked={
                      exportSettings.include_company_details
                    }
                    onChange={
                      handleExportChange
                    }
                  />
                  Include company details
                </label>

                <label>
                  <input
                    type="checkbox"
                    name="include_signature"
                    checked={
                      exportSettings.include_signature
                    }
                    onChange={
                      handleExportChange
                    }
                  />
                  Include authorised signature area
                </label>

                <label>
                  <input
                    type="checkbox"
                    name="include_timestamp"
                    checked={
                      exportSettings.include_timestamp
                    }
                    onChange={
                      handleExportChange
                    }
                  />
                  Include generated timestamp
                </label>

                <label>
                  <input
                    type="checkbox"
                    name="include_confidential_label"
                    checked={
                      exportSettings.include_confidential_label
                    }
                    onChange={
                      handleExportChange
                    }
                  />
                  Include confidential report label
                </label>
              </div>

              <button type="submit">
                Save Export Settings
              </button>
            </form>
          </div>

          <div className="panel">
            <h2>Export Preview</h2>

            <div className="form-section-title">
              <h3>
                {companyForm.company_name ||
                  "Construction Portal"}
              </h3>

              <p>
                {companyForm.address ||
                  "Company address"}
              </p>

              <p>
                {exportSettings.report_footer ||
                  "Generated from Construction Portal"}
              </p>

              {exportSettings.watermark && (
                <p>
                  Watermark:{" "}
                  {
                    exportSettings.watermark
                  }
                </p>
              )}
            </div>

            <table>
              <tbody>
                <tr>
                  <td>Paper Size</td>
                  <td>
                    {
                      exportSettings.paper_size
                    }
                  </td>
                </tr>

                <tr>
                  <td>Orientation</td>
                  <td>
                    {
                      exportSettings.orientation
                    }
                  </td>
                </tr>

                <tr>
                  <td>Watermark</td>
                  <td>
                    {exportSettings.watermark ||
                      "None"}
                  </td>
                </tr>

                <tr>
                  <td>
                    Signature Area
                  </td>
                  <td>
                    {exportSettings.include_signature
                      ? "Included"
                      : "Excluded"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeSection === "security" && (
        <section className="payment-grid">
          <div className="panel">
            <h2>Change Password</h2>

            <form
              className="payment-form"
              onSubmit={
                handleChangePassword
              }
            >
              <label>
                Current Password
                <input
                  type={
                    showPasswords
                      ? "text"
                      : "password"
                  }
                  name="current_password"
                  autoComplete="current-password"
                  value={
                    passwordForm.current_password
                  }
                  onChange={
                    handlePasswordChange
                  }
                  disabled={
                    passwordSubmitting
                  }
                  required
                />
              </label>

              <label>
                New Password
                <input
                  type={
                    showPasswords
                      ? "text"
                      : "password"
                  }
                  name="new_password"
                  autoComplete="new-password"
                  value={
                    passwordForm.new_password
                  }
                  onChange={
                    handlePasswordChange
                  }
                  disabled={
                    passwordSubmitting
                  }
                  minLength={8}
                  required
                />
              </label>

              <label>
                Confirm New Password
                <input
                  type={
                    showPasswords
                      ? "text"
                      : "password"
                  }
                  name="confirm_password"
                  autoComplete="new-password"
                  value={
                    passwordForm.confirm_password
                  }
                  onChange={
                    handlePasswordChange
                  }
                  disabled={
                    passwordSubmitting
                  }
                  minLength={8}
                  required
                />
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={showPasswords}
                  onChange={(event) =>
                    setShowPasswords(
                      event.target.checked
                    )
                  }
                  disabled={
                    passwordSubmitting
                  }
                />

                Show password fields
              </label>

              <div className="form-preview-total">
                Password Strength:{" "}
                {passwordStrengthLabel}
              </div>

              <button
                type="submit"
                disabled={
                  passwordSubmitting
                }
              >
                {passwordSubmitting
                  ? "Updating..."
                  : "Change Password"}
              </button>
            </form>
          </div>

          <div className="panel">
            <h2>Account Security</h2>

            <div className="settings-info-list">
              <div>
                <span>Account</span>
                <strong>
                  {user?.full_name ||
                    "Not available"}
                </strong>
              </div>

              <div>
                <span>Email</span>
                <strong>
                  {user?.email ||
                    "Not available"}
                </strong>
              </div>

              <div>
                <span>Role</span>
                <strong>
                  {user?.role ||
                    "Not available"}
                </strong>
              </div>

              <div>
                <span>
                  Password Requirement
                </span>
                <strong>
                  Minimum 8 characters
                </strong>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeSection === "data" && (
        <section className="payment-grid">
          <div className="panel">
            <h2>Settings Backup</h2>

            <p className="muted-text">
              Download or restore local company and application
              configuration.
            </p>

            <div className="form-actions">
              <button
                type="button"
                onClick={
                  handleDownloadBackup
                }
              >
                Download Backup
              </button>

              <button
                type="button"
                className="secondary-btn"
                onClick={() =>
                  backupInputRef.current?.click()
                }
              >
                Restore Backup
              </button>

              <input
                ref={backupInputRef}
                type="file"
                accept="application/json,.json"
                onChange={
                  handleBackupImport
                }
                hidden
              />
            </div>
          </div>

          <div className="panel">
            <h2>
              Reset Local Settings
            </h2>

            <p className="muted-text">
              This resets only settings stored in the current
              browser. It does not delete portal records.
            </p>

            <button
              type="button"
              className="delete-btn"
              onClick={
                handleResetLocalSettings
              }
            >
              Reset Local Settings
            </button>
          </div>
        </section>
      )}

      {activeSection === "about" && (
        <section className="payment-grid">
          <div className="panel">
            <h2>
              Construction Portal
            </h2>

            <p className="muted-text">
              Construction management portal for finance, sites,
              tenders, workers, subcontractors, approvals and
              reporting.
            </p>

            <div className="settings-info-list">
              <div>
                <span>Application</span>
                <strong>
                  Construction Portal
                </strong>
              </div>

              <div>
                <span>Version</span>
                <strong>1.0.0</strong>
              </div>

              <div>
                <span>
                  Settings Storage
                </span>
                <strong>
                  Current browser
                </strong>
              </div>

              <div>
                <span>Current User</span>
                <strong>
                  {user?.full_name ||
                    "Not available"}
                </strong>
              </div>
            </div>
          </div>

          <div className="panel">
            <h2>Important</h2>

            <p className="muted-text">
              Company and application settings currently use
              browser storage. They should later be moved to the
              backend so the same settings apply across devices and
              users.
            </p>
          </div>
        </section>
      )}
    </>
  );
}

export default SettingsPage;