import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getSubcontractorProfile,
  getSubcontractorTenders,
  getSubcontractorTenderDetails,
  createSubcontractorDailyUpdate,
  addSubcontractorTenderDocument,
} from "../services/subcontractorPortalService";

import { uploadFile } from "../services/uploadService";

function SubcontractorPortalPage({ logout }) {
  const navigate = useNavigate();

  const [subcontractor, setSubcontractor] = useState(null);
  const [tenders, setTenders] = useState([]);
  const [selectedTender, setSelectedTender] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [banking, setBanking] = useState([]);
  const [updates, setUpdates] = useState([]);

  const [dailyForm, setDailyForm] = useState({
    log_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [dailyPhoto, setDailyPhoto] = useState(null);

  const [documentForm, setDocumentForm] = useState({
    document_name: "",
    document_type: "PDF",
  });

  const [documentFile, setDocumentFile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const openTender = async (tenderId) => {
    try {
      const data = await getSubcontractorTenderDetails(tenderId);

      setSelectedTender(data.tender);
      setDocuments(data.documents || []);
      setMaterials(data.materials || []);
      setBanking(data.banking || []);
      setUpdates(data.updates || []);
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to load tender details");
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const profileData = await getSubcontractorProfile();
      const tendersData = await getSubcontractorTenders();

      setSubcontractor(profileData.subcontractor);
      setTenders(tendersData.tenders || []);

      if (tendersData.tenders?.length === 1) {
        await openTender(tendersData.tenders[0].tender_id);
      }
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Failed to load subcontractor portal"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleDailyChange = (e) => {
    setDailyForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleDailySubmit = async (e) => {
    e.preventDefault();

    if (!selectedTender) {
      setMessage("Please select a tender first.");
      return;
    }

    try {
      let photoUrl = null;

      if (dailyPhoto) {
        photoUrl = await uploadFile(dailyPhoto, "subcontractor-updates");
      }

      const result = await createSubcontractorDailyUpdate({
        site_id: selectedTender.site_id,
        tender_id: selectedTender.id,
        log_date: dailyForm.log_date,
        notes: dailyForm.notes,
        photo_url: photoUrl,
      });

      setMessage(result.message || "Daily update submitted.");
      setDailyForm({
        log_date: new Date().toISOString().split("T")[0],
        notes: "",
      });
      setDailyPhoto(null);

      await openTender(selectedTender.id);
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to submit update.");
    }
  };

  const handleDocumentSubmit = async (e) => {
    e.preventDefault();

    if (!selectedTender) {
      setMessage("Please select a tender first.");
      return;
    }

    try {
      let fileUrl = null;

      if (documentFile) {
        fileUrl = await uploadFile(documentFile, "subcontractor-updates");
      }

      await addSubcontractorTenderDocument({
        tender_id: selectedTender.id,
        document_name: documentForm.document_name,
        document_type: documentForm.document_type,
        file_url: fileUrl,
      });

      setMessage("Document uploaded successfully.");
      setDocumentForm({
        document_name: "",
        document_type: "PDF",
      });
      setDocumentFile(null);

      await openTender(selectedTender.id);
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to upload document.");
    }
  };

  if (loading) {
    return (
      <main className="subcontractor-portal-page">
        <div className="panel">Loading subcontractor portal...</div>
      </main>
    );
  }

  return (
    <main className="subcontractor-portal-page">
      <section className="worker-header">
        <div>
          <h1>Subcontractor Portal</h1>
          <p>Welcome back, {subcontractor?.full_name}</p>
        </div>

        <button type="button" className="delete-btn" onClick={handleLogout}>
          Logout
        </button>
      </section>

      {message && <p className="success-message">{message}</p>}

      <section className="cards">
        <div className="card">
          <p>Subcontractor</p>
          <h2>{subcontractor?.full_name || "N/A"}</h2>
        </div>

        <div className="card">
          <p>Assigned Tenders</p>
          <h2>{tenders.length}</h2>
        </div>

        <div className="card">
          <p>Business</p>
          <h2>{subcontractor?.business_name || "N/A"}</h2>
        </div>

        <div className="card">
          <p>Status</p>
          <h2>{subcontractor?.subcontractor_status || "N/A"}</h2>
        </div>
      </section>

      <section className="payment-grid">
        <div className="panel">
          <h2>My Assigned Tenders</h2>

          <table>
            <thead>
              <tr>
                <th>Tender</th>
                <th>Site</th>
                <th>Status</th>
                <th>Assigned Amount</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {tenders.map((item) => (
                <tr key={item.assignment_id}>
                  <td>{item.tender_title}</td>
                  <td>{item.site_name}</td>
                  <td>{item.assignment_status}</td>
                  <td>${Number(item.assigned_amount || 0).toFixed(2)}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => openTender(item.tender_id)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}

              {tenders.length === 0 && (
                <tr>
                  <td colSpan="5">No assigned tenders found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2>My Profile</h2>

          <table>
            <tbody>
              <tr>
                <th>Name</th>
                <td>{subcontractor?.full_name}</td>
              </tr>
              <tr>
                <th>Email</th>
                <td>{subcontractor?.email || subcontractor?.login_email}</td>
              </tr>
              <tr>
                <th>Phone</th>
                <td>{subcontractor?.phone}</td>
              </tr>
              <tr>
                <th>Business</th>
                <td>{subcontractor?.business_name}</td>
              </tr>
              <tr>
                <th>GST</th>
                <td>{subcontractor?.gst_number}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {selectedTender && (
        <>
          <section className="panel">
            <h2>Selected Tender: {selectedTender.title}</h2>
            <p>
              Site: {selectedTender.site_name} | Status: {selectedTender.status}
            </p>
          </section>

          <section className="payment-grid">
            <div className="panel">
              <h2>Submit Daily Update</h2>

              <form className="payment-form" onSubmit={handleDailySubmit}>
                <input
                  name="log_date"
                  type="date"
                  value={dailyForm.log_date}
                  onChange={handleDailyChange}
                  required
                />

                <textarea
                  name="notes"
                  placeholder="Daily update notes"
                  value={dailyForm.notes}
                  onChange={handleDailyChange}
                />

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setDailyPhoto(e.target.files?.[0] || null)}
                />

                <button type="submit">Submit Update</button>
              </form>
            </div>

            <div className="panel">
              <h2>Upload Document</h2>

              <form className="payment-form" onSubmit={handleDocumentSubmit}>
                <input
                  placeholder="Document name"
                  value={documentForm.document_name}
                  onChange={(e) =>
                    setDocumentForm((prev) => ({
                      ...prev,
                      document_name: e.target.value,
                    }))
                  }
                  required
                />

                <select
                  value={documentForm.document_type}
                  onChange={(e) =>
                    setDocumentForm((prev) => ({
                      ...prev,
                      document_type: e.target.value,
                    }))
                  }
                >
                  <option value="PDF">PDF</option>
                  <option value="Word">Word</option>
                  <option value="JPG">JPG</option>
                  <option value="PNG">PNG</option>
                </select>

                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                />

                <button type="submit">Upload Document</button>
              </form>
            </div>
          </section>

          <section className="payment-grid">
            <div className="panel">
              <h2>Documents</h2>

              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>File</th>
                  </tr>
                </thead>

                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id}>
                      <td>{doc.document_name}</td>
                      <td>{doc.document_type}</td>
                      <td>
                        {doc.file_url ? (
                          <a href={doc.file_url} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}

                  {documents.length === 0 && (
                    <tr>
                      <td colSpan="3">No documents found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="panel">
              <h2>Daily Updates</h2>

              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>By</th>
                    <th>Notes</th>
                    <th>Photo</th>
                  </tr>
                </thead>

                <tbody>
                  {updates.map((item) => (
                    <tr key={item.id}>
                      <td>{item.log_date?.slice(0, 10)}</td>
                      <td>
                        {item.subcontractor_name || item.worker_name || "N/A"}
                      </td>
                      <td>{item.notes}</td>
                      <td>
                        {item.photo_url ? (
                          <a href={item.photo_url} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}

                  {updates.length === 0 && (
                    <tr>
                      <td colSpan="4">No updates found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="payment-grid">
            <div className="panel">
              <h2>Materials</h2>

              <table>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Total</th>
                  </tr>
                </thead>

                <tbody>
                  {materials.map((item) => (
                    <tr key={item.id}>
                      <td>{item.material_name}</td>
                      <td>{item.quantity}</td>
                      <td>{item.rate}</td>
                      <td>${Number(item.total_amount || 0).toFixed(2)}</td>
                    </tr>
                  ))}

                  {materials.length === 0 && (
                    <tr>
                      <td colSpan="4">No materials found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="panel">
              <h2>Banking</h2>

              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>GST</th>
                    <th>Date</th>
                  </tr>
                </thead>

                <tbody>
                  {banking.map((item) => (
                    <tr key={item.id}>
                      <td>{item.payment_type}</td>
                      <td>${Number(item.amount || 0).toFixed(2)}</td>
                      <td>${Number(item.gst_amount || 0).toFixed(2)}</td>
                      <td>{item.payment_date?.slice(0, 10)}</td>
                    </tr>
                  ))}

                  {banking.length === 0 && (
                    <tr>
                      <td colSpan="4">No banking records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default SubcontractorPortalPage;