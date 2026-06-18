import { useEffect, useState } from "react";
import DeleteVerificationModal from "../components/DeleteVerificationModal";

import {
  getSubcontractors,
  createSubcontractor,
  deleteSubcontractor,
  updateSubcontractor,
} from "../services/subcontractorService";

function SubcontractorsPage() {
  const [subcontractors, setSubcontractors] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingSubcontractor, setEditingSubcontractor] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

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

  const [formData, setFormData] = useState(emptyForm);

  const filteredSubcontractors = subcontractors.filter((sub) => {
    const search = searchTerm.toLowerCase();

    return (
      sub.full_name?.toLowerCase().includes(search) ||
      sub.phone?.toLowerCase().includes(search) ||
      sub.email?.toLowerCase().includes(search) ||
      sub.business_name?.toLowerCase().includes(search) ||
      sub.gst_number?.toLowerCase().includes(search) ||
      sub.bank_name?.toLowerCase().includes(search) ||
      sub.account_name?.toLowerCase().includes(search) ||
      sub.account_number?.toLowerCase().includes(search) ||
      sub.ifsc_code?.toLowerCase().includes(search) ||
      sub.status?.toLowerCase().includes(search)
    );
  });

  const fetchSubcontractors = async () => {
    try {
      const data = await getSubcontractors();

      setSubcontractors(data.subcontractors || []);
    } catch (err) {
      console.error("Failed to load subcontractors", err);
    }
  };

  useEffect(() => {
    fetchSubcontractors();
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingSubcontractor(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingSubcontractor) {
        const result = await updateSubcontractor(
          editingSubcontractor.id,
          formData
        );

        console.log("Subcontractor updated:", result);
      } else {
        const result = await createSubcontractor({
          company_id: null,
          ...formData,
        });

        console.log("Subcontractor created:", result);
      }

      resetForm();
      await fetchSubcontractors();
    } catch (err) {
      console.error("Failed to save subcontractor:", err.response?.data || err);
    }
  };

  const startEdit = (sub) => {
    setEditingSubcontractor(sub);

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
      status: sub.status || "active",
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    await deleteSubcontractor(deleteTarget.id);
    setDeleteTarget(null);
    await fetchSubcontractors();
  };

  return (
    <>
      <section className="payment-grid">
        <div className="panel">
          <h2>
            {editingSubcontractor
              ? "Edit Subcontractor"
              : "Add Subcontractor"}
          </h2>

          <form className="payment-form" onSubmit={handleSubmit}>
            <input
              name="full_name"
              placeholder="Full Name"
              value={formData.full_name}
              onChange={handleChange}
              required
            />

            <input
              name="business_name"
              placeholder="Business Name"
              value={formData.business_name}
              onChange={handleChange}
            />

            <input
              name="phone"
              placeholder="Phone"
              value={formData.phone}
              onChange={handleChange}
            />

            <input
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
            />

            <input
              name="gst_number"
              placeholder="GST Number"
              value={formData.gst_number}
              onChange={handleChange}
            />

            <input
              name="bank_name"
              placeholder="Bank Name"
              value={formData.bank_name}
              onChange={handleChange}
            />

            <input
              name="account_name"
              placeholder="Account Name"
              value={formData.account_name}
              onChange={handleChange}
            />

            <input
              name="account_number"
              placeholder="Account Number"
              value={formData.account_number}
              onChange={handleChange}
            />

            <input
              name="ifsc_code"
              placeholder="IFSC / BSB Code"
              value={formData.ifsc_code}
              onChange={handleChange}
            />

            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <button type="submit">
              {editingSubcontractor ? "Save Changes" : "Add Subcontractor"}
            </button>

            {editingSubcontractor && (
              <button type="button" onClick={resetForm}>
                Cancel
              </button>
            )}
          </form>
        </div>

        <div className="panel">
          <h2>Subcontractors List</h2>

          <input
            className="search-input"
            type="text"
            placeholder="Search subcontractors by name, business, phone, GST, bank or status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Business</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Bank</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredSubcontractors.map((sub) => (
                <tr key={sub.id}>
                  <td>{sub.full_name}</td>
                  <td>{sub.business_name}</td>
                  <td>{sub.phone}</td>
                  <td>{sub.email}</td>
                  <td>{sub.bank_name}</td>
                  <td>{sub.status}</td>
                  <td>
                    <button type="button" onClick={() => startEdit(sub)}>
                      Edit
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
                  <td colSpan="7" className="empty-table-message">
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