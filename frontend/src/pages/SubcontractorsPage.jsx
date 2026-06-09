import { useEffect, useState } from "react";
import {
  getSubcontractors,
  createSubcontractor,
  deleteSubcontractor,
} from "../services/subcontractorService";

function SubcontractorsPage() {
  const [subcontractors, setSubcontractors] = useState([]);

  const [formData, setFormData] = useState({
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
  });

  const fetchSubcontractors = async () => {
    const data = await getSubcontractors();
    setSubcontractors(data.subcontractors || []);
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    await createSubcontractor({
      company_id: null,
      ...formData,
    });

    setFormData({
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
    });

    fetchSubcontractors();
  };

  const handleDelete = async (id) => {
    await deleteSubcontractor(id);
    fetchSubcontractors();
  };

  return (
    <section className="payment-grid">
      <div className="panel">
        <h2>Add Subcontractor</h2>

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

          <button type="submit">Add Subcontractor</button>
        </form>
      </div>

      <div className="panel">
        <h2>Subcontractors List</h2>

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
            {subcontractors.map((sub) => (
              <tr key={sub.id}>
                <td>{sub.full_name}</td>
                <td>{sub.business_name}</td>
                <td>{sub.phone}</td>
                <td>{sub.email}</td>
                <td>{sub.bank_name}</td>
                <td>{sub.status}</td>
                <td>
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(sub.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}

            {subcontractors.length === 0 && (
              <tr>
                <td colSpan="7">No subcontractors added yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default SubcontractorsPage;