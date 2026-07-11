import { useEffect, useMemo, useState } from "react";
import DeleteVerificationModal from "../components/DeleteVerificationModal";
import ExportButtons from "../components/export/ExportButtons";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

import {
  getSubcontractors,
  createSubcontractor,
  deleteSubcontractor,
  updateSubcontractor,
} from "../services/subcontractorService";

function SubcontractorsPage() {
  const emptyForm = {
    full_name: "",
    phone: "",
    email: "",
    business_name: "",
    gst_number: "",
    bank_name: "",
    account_name: "",
    account_number: "",
    ifsc_code: "",
    status: "active",
  };
  const { user } = useAuth();

  const [subcontractors, setSubcontractors] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingSubcontractor, setEditingSubcontractor] = useState(null);
  const [selectedSubcontractor, setSelectedSubcontractor] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const normaliseStatus = (value) =>
    String(value || "active").trim().toLowerCase();

  const getStatusClass = (status) =>
    normaliseStatus(status) === "active"
      ? "badge green"
      : "badge yellow";

  const fetchSubcontractors = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getSubcontractors();
      setSubcontractors(data.subcontractors || []);
    } catch (err) {
      console.error("Failed to load subcontractors", err);
      setError(
        err.response?.data?.message || "Failed to load subcontractors."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubcontractors();
  }, []);

  const totals = useMemo(() => {
    const active = subcontractors.filter(
      (sub) => normaliseStatus(sub.status) === "active"
    );

    const inactive = subcontractors.filter(
      (sub) => normaliseStatus(sub.status) === "inactive"
    );

    const withGST = subcontractors.filter((sub) =>
      String(sub.gst_number || "").trim()
    );

    const withBankDetails = subcontractors.filter(
      (sub) =>
        String(sub.bank_name || "").trim() &&
        String(sub.account_number || "").trim()
    );

    const withEmail = subcontractors.filter((sub) =>
      String(sub.email || "").trim()
    );

    return {
      active: active.length,
      inactive: inactive.length,
      withGST: withGST.length,
      withBankDetails: withBankDetails.length,
      withEmail: withEmail.length,
    };
  }, [subcontractors]);

  const filteredSubcontractors = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return subcontractors.filter((sub) => {
      const status = normaliseStatus(sub.status);

      const matchesStatus =
        statusFilter === "all" || status === statusFilter;

      const matchesSearch =
        !search ||
        sub.full_name?.toLowerCase().includes(search) ||
        sub.phone?.toLowerCase().includes(search) ||
        sub.email?.toLowerCase().includes(search) ||
        sub.business_name?.toLowerCase().includes(search) ||
        sub.gst_number?.toLowerCase().includes(search) ||
        sub.bank_name?.toLowerCase().includes(search) ||
        sub.account_name?.toLowerCase().includes(search) ||
        sub.account_number?.toLowerCase().includes(search) ||
        sub.ifsc_code?.toLowerCase().includes(search) ||
        status.includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [subcontractors, searchTerm, statusFilter]);

  const subcontractorExportColumns = [
    { key: "full_name", label: "Name" },
    { key: "business_name", label: "Business" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "gst_number", label: "GST Number" },
    { key: "bank_name", label: "Bank" },
    { key: "account_name", label: "Account Name" },
    { key: "account_number", label: "Account Number" },
    { key: "ifsc_code", label: "IFSC / BSB" },
    { key: "status", label: "Status" },
  ];

  const subcontractorExportRows = filteredSubcontractors.map((sub) => ({
    full_name: sub.full_name || "",
    business_name: sub.business_name || "",
    phone: sub.phone || "",
    email: sub.email || "",
    gst_number: sub.gst_number || "",
    bank_name: sub.bank_name || "",
    account_name: sub.account_name || "",
    account_number: sub.account_number || "",
    ifsc_code: sub.ifsc_code || "",
    status: normaliseStatus(sub.status),
  }));

  const subcontractorExportSummary = {
    "Total Subcontractors": subcontractors.length,
    "Active Subcontractors": totals.active,
    "Inactive Subcontractors": totals.inactive,
    "GST Registered": totals.withGST,
    "Bank Details Available": totals.withBankDetails,
    "Email Available": totals.withEmail,
    "Filtered Records": filteredSubcontractors.length,
  };

  const handleChange = (event) => {
    setFormData((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingSubcontractor(null);
  };

  const startEdit = (sub) => {
    setEditingSubcontractor(sub);
    setSelectedSubcontractor(sub);

    setFormData({
      full_name: sub.full_name || "",
      phone: sub.phone || "",
      email: sub.email || "",
      business_name: sub.business_name || "",
      gst_number: sub.gst_number || "",
      bank_name: sub.bank_name || "",
      account_name: sub.account_name || "",
      account_number: sub.account_number || "",
      ifsc_code: sub.ifsc_code || "",
      status: normaliseStatus(sub.status),
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    try {
      setSubmitting(true);
      setMessage("");
      setError("");

      const payload = {
        ...formData,
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        business_name: formData.business_name.trim(),
        gst_number: formData.gst_number.trim(),
        bank_name: formData.bank_name.trim(),
        account_name: formData.account_name.trim(),
        account_number: formData.account_number.trim(),
        ifsc_code: formData.ifsc_code.trim(),
      };

      if (editingSubcontractor) {
        await updateSubcontractor(editingSubcontractor.id, payload);
        setMessage("Subcontractor updated successfully.");
      } else {
        await createSubcontractor({
          company_id: user?.company_id || null,
          ...payload,
        });

        setMessage("Subcontractor added successfully.");
      }

      resetForm();
      await fetchSubcontractors();
    } catch (err) {
      console.error(
        "Failed to save subcontractor:",
        err.response?.data || err
      );

      setError(
        err.response?.data?.message || "Failed to save subcontractor."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setError("");
      setMessage("");

      await deleteSubcontractor(deleteTarget.id);

      if (selectedSubcontractor?.id === deleteTarget.id) {
        setSelectedSubcontractor(null);
      }

      if (editingSubcontractor?.id === deleteTarget.id) {
        resetForm();
      }

      setDeleteTarget(null);
      setMessage("Subcontractor deleted successfully.");

      await fetchSubcontractors();
    } catch (err) {
      console.error(
        "Failed to delete subcontractor:",
        err.response?.data || err
      );
    
      setError(
        err.response?.data?.message ||
          "Failed to delete subcontractor."
      );
    }
  };

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
  };

  if (loading) {
    return <div className="panel">Loading subcontractors...</div>;
  }

  return (
    <>
      {message && <p className="success-message">{message}</p>}
      {error && <p className="error">{error}</p>}

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Subcontractors Management</h2>

            <p className="muted-text">
              Manage subcontractor contact, business, GST and banking
              information.
            </p>
          </div>

          <ExportButtons
            filename="subcontractors"
            title="Subcontractors Report"
            subtitle="Construction Portal subcontractor register"
            rows={subcontractorExportRows}
            columns={subcontractorExportColumns}
            summary={subcontractorExportSummary}
          />
        </div>
      </section>

      <section className="summary-cards">
        <div className="card">
          <p>Total Subcontractors</p>
          <h2>{subcontractors.length}</h2>
        </div>

        <div className="card highlight-success">
          <p>Active</p>
          <h2>{totals.active}</h2>
        </div>

        <div className="card highlight-warning">
          <p>Inactive</p>
          <h2>{totals.inactive}</h2>
        </div>

        <div className="card">
          <p>GST Registered</p>
          <h2>{totals.withGST}</h2>
        </div>

        <div className="card">
          <p>Bank Details Available</p>
          <h2>{totals.withBankDetails}</h2>
        </div>

        <div className="card">
          <p>Filtered Records</p>
          <h2>{filteredSubcontractors.length}</h2>
        </div>
      </section>

      <section className="payment-grid">
        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                {editingSubcontractor
                  ? "Edit Subcontractor"
                  : "Add Subcontractor"}
              </h2>

              <p className="muted-text">
                {editingSubcontractor
                  ? "Update subcontractor identity, business and bank details."
                  : "Create a subcontractor record for future tender assignment."}
              </p>
            </div>
          </div>

          <form className="payment-form" onSubmit={handleSubmit}>
            <div className="form-section-title">
              <h3>Contact and Business Details</h3>
              <p className="muted-text">
                Primary identity and communication information.
              </p>
            </div>

            <div className="form-grid">
              <label>
                Full Name
                <input
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Business Name
                <input
                  name="business_name"
                  value={formData.business_name}
                  onChange={handleChange}
                />
              </label>

              <label>
                Phone
                <input
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </label>

              <label>
                Email
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </label>

              <label>
                GST Number
                <input
                  name="gst_number"
                  value={formData.gst_number}
                  onChange={handleChange}
                />
              </label>

              <label>
                Status
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>

            <div className="form-section-title">
              <h3>Banking Details</h3>
              <p className="muted-text">
                Payment account details used for subcontractor settlements.
              </p>
            </div>

            <div className="form-grid">
              <label>
                Bank Name
                <input
                  name="bank_name"
                  value={formData.bank_name}
                  onChange={handleChange}
                />
              </label>

              <label>
                Account Name
                <input
                  name="account_name"
                  value={formData.account_name}
                  onChange={handleChange}
                />
              </label>

              <label>
                Account Number
                <input
                  name="account_number"
                  value={formData.account_number}
                  onChange={handleChange}
                />
              </label>

              <label>
                IFSC / BSB Code
                <input
                  name="ifsc_code"
                  value={formData.ifsc_code}
                  onChange={handleChange}
                />
              </label>
            </div>

            <div className="form-preview-total">
              Record Preview: {formData.full_name || "Subcontractor"}
              {formData.business_name
                ? ` · ${formData.business_name}`
                : ""}
              {formData.gst_number
                ? ` · GST ${formData.gst_number}`
                : ""}
            </div>

            <div className="form-actions">
              <button type="submit" disabled={submitting}>
                {submitting
                  ? "Saving..."
                  : editingSubcontractor
                  ? "Save Changes"
                  : "Add Subcontractor"}
              </button>

              {editingSubcontractor && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={resetForm}
                  disabled={submitting}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Subcontractor Filters</h2>

              <p className="muted-text">
                Search by name, business, contact, GST, bank account or status.
              </p>
            </div>

            <button
              type="button"
              className="secondary-btn"
              onClick={resetFilters}
            >
              Reset
            </button>
          </div>

          <div className="tabs">
            <button
              type="button"
              className={statusFilter === "all" ? "active-tab" : ""}
              onClick={() => setStatusFilter("all")}
            >
              All
            </button>

            <button
              type="button"
              className={statusFilter === "active" ? "active-tab" : ""}
              onClick={() => setStatusFilter("active")}
            >
              Active
            </button>

            <button
              type="button"
              className={statusFilter === "inactive" ? "active-tab" : ""}
              onClick={() => setStatusFilter("inactive")}
            >
              Inactive
            </button>
          </div>

          <label>
            Search
            <input
              className="search-input"
              type="text"
              placeholder="Search subcontractors..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>

          <table>
            <tbody>
              <tr>
                <td>Status Filter</td>
                <td>{statusFilter}</td>
              </tr>

              <tr>
                <td>Matching Records</td>
                <td className="number-cell">
                  {filteredSubcontractors.length}
                </td>
              </tr>

              <tr>
                <td>GST Registered</td>
                <td className="number-cell">{totals.withGST}</td>
              </tr>

              <tr>
                <td>Bank Details Available</td>
                <td className="number-cell">
                  {totals.withBankDetails}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {selectedSubcontractor && (
        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>Subcontractor Preview</h2>

              <p className="muted-text">
                Contact, business and settlement information.
              </p>
            </div>

            <button
              type="button"
              className="secondary-btn"
              onClick={() => setSelectedSubcontractor(null)}
            >
              Close Preview
            </button>
          </div>

          <section className="summary-cards">
            <div className="card">
              <p>Name</p>
              <h2>{selectedSubcontractor.full_name || "-"}</h2>
            </div>

            <div className="card">
              <p>Business</p>
              <h2>{selectedSubcontractor.business_name || "-"}</h2>
            </div>

            <div className="card">
              <p>GST Number</p>
              <h2>{selectedSubcontractor.gst_number || "-"}</h2>
            </div>

            <div className="card">
              <p>Bank</p>
              <h2>{selectedSubcontractor.bank_name || "-"}</h2>
            </div>

            <div className="card">
              <p>Account Name</p>
              <h2>{selectedSubcontractor.account_name || "-"}</h2>
            </div>

            <div className="card">
              <p>Status</p>
              <h2>
                <span
                  className={getStatusClass(
                    selectedSubcontractor.status
                  )}
                >
                  {normaliseStatus(selectedSubcontractor.status)}
                </span>
              </h2>
            </div>
          </section>

          <div className="table-wrapper">
            <table>
              <tbody>
                <tr>
                  <th>Phone</th>
                  <td>{selectedSubcontractor.phone || "-"}</td>
                </tr>

                <tr>
                  <th>Email</th>
                  <td>{selectedSubcontractor.email || "-"}</td>
                </tr>

                <tr>
                  <th>Account Number</th>
                  <td>{selectedSubcontractor.account_number || "-"}</td>
                </tr>

                <tr>
                  <th>IFSC / BSB</th>
                  <td>{selectedSubcontractor.ifsc_code || "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Subcontractors Register</h2>

            <p className="muted-text">
              {filteredSubcontractors.length} matching subcontractor
              {filteredSubcontractors.length === 1 ? "" : "s"}.
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Business</th>
                <th>Phone</th>
                <th>Email</th>
                <th>GST</th>
                <th>Bank</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredSubcontractors.map((sub) => (
                <tr key={sub.id}>
                  <td>
                    <button
                      type="button"
                      className="table-link-button"
                      onClick={() => setSelectedSubcontractor(sub)}
                    >
                      {sub.full_name || "-"}
                    </button>
                  </td>

                  <td>{sub.business_name || "-"}</td>
                  <td>{sub.phone || "-"}</td>
                  <td>{sub.email || "-"}</td>
                  <td>{sub.gst_number || "-"}</td>
                  <td>{sub.bank_name || "-"}</td>

                  <td>
                    <span className={getStatusClass(sub.status)}>
                      {normaliseStatus(sub.status)}
                    </span>
                  </td>

                  <td>
                    <button
                      type="button"
                      onClick={() => startEdit(sub)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => setSelectedSubcontractor(sub)}
                    >
                      Preview
                    </button>

                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => setDeleteTarget(sub)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {filteredSubcontractors.length === 0 && (
                <tr>
                  <td colSpan="8" className="empty-table-message">
                    No subcontractors found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <DeleteVerificationModal
        open={!!deleteTarget}
        itemName={deleteTarget?.full_name || "subcontractor"}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

export default SubcontractorsPage;