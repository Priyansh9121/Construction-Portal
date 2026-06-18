import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getSubcontractorProfile,
  getSubcontractorTenders,
  getSubcontractorTenderDetails,
} from "../services/subcontractorPortalService";

function SubcontractorPortalPage({ logout }) {
  const navigate = useNavigate();

  const [subcontractor, setSubcontractor] = useState(null);
  const [tenders, setTenders] = useState([]);
  const [selectedTender, setSelectedTender] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [banking, setBanking] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

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

  const openTender = async (tenderId) => {
    try {
      const data = await getSubcontractorTenderDetails(tenderId);

      setSelectedTender(data.tender);
      setDocuments(data.documents || []);
      setMaterials(data.materials || []);
      setBanking(data.banking || []);
      setUpdates(data.updates || []);
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.data?.message || "Failed to load tender details"
      );
    }
  };

  const closeTenderDetails = () => {
    setSelectedTender(null);
    setDocuments([]);
    setMaterials([]);
    setBanking([]);
    setUpdates([]);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (loading) {
    return (
      <main className="worker-portal-page">
        <section className="payment-grid">
          <div className="panel">
            <h2>Subcontractor Portal</h2>
            <p>Loading subcontractor portal...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="worker-portal-page">
      <section className="worker-header">
        <div>
          <h1>Subcontractor Portal</h1>
          <p>Welcome back, {subcontractor?.full_name}</p>
        </div>

        <button type="button" className="delete-btn" onClick={handleLogout}>
          Logout
        </button>
      </section>

      {message && <p>{message}</p>}

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

      <section className="worker-grid">
        <div className="panel">
          <h2>My Profile</h2>

          <table>
            <tbody>
              <tr>
                <th>Name</th>
                <td>{subcontractor?.full_name}</td>
              </tr>
              <tr>
                <th>Login Email</th>
                <td>{subcontractor?.login_email}</td>
              </tr>
              <tr>
                <th>Contact Email</th>
                <td>{subcontractor?.email}</td>
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
              <tr>
                <th>Status</th>
                <td>{subcontractor?.subcontractor_status}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h2>My Assigned Tenders</h2>

          <table>
            <thead>
              <tr>
                <th>Site</th>
                <th>Tender</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Assigned Amount</th>
                <th>Work</th>
              </tr>
            </thead>

            <tbody>
              {tenders.map((item) => (
                <tr key={item.assignment_id}>
                  <td>{item.site_name}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => openTender(item.tender_id)}
                    >
                      {item.tender_title}
                    </button>
                  </td>
                  <td>{item.tender_status}</td>
                  <td>{item.due_date?.slice(0, 10)}</td>
                  <td>${Number(item.assigned_amount || 0).toFixed(2)}</td>
                  <td>{item.work_description}</td>
                </tr>
              ))}

              {tenders.length === 0 && (
                <tr>
                  <td colSpan="6">No assigned tenders found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedTender && (
        <>
          <section className="worker-grid">
            <div className="panel">
              <button type="button" onClick={closeTenderDetails}>
                Close Tender Details
              </button>
            </div>

            <div className="panel">
              <h2>Tender Details</h2>

              <table>
                <tbody>
                  <tr>
                    <th>Title</th>
                    <td>{selectedTender.title}</td>
                  </tr>
                  <tr>
                    <th>Status</th>
                    <td>{selectedTender.status}</td>
                  </tr>
                  <tr>
                    <th>Due Date</th>
                    <td>{selectedTender.due_date?.slice(0, 10)}</td>
                  </tr>
                  <tr>
                    <th>Site</th>
                    <td>{selectedTender.site_name}</td>
                  </tr>
                  <tr>
                    <th>Description</th>
                    <td>{selectedTender.description}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="panel">
              <h2>Documents</h2>

              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Open</th>
                  </tr>
                </thead>

                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id}>
                      <td>{doc.document_name}</td>
                      <td>{doc.document_type}</td>
                      <td>
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noreferrer"
                        >
                        Open
                        </a>

                        {" | "}

                        <a
                        href={doc.file_url}
                        download
                        >
                        Download
                        </a>
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
              <h2>Materials</h2>

              <table>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Quantity</th>
                    <th>Vendor</th>
                  </tr>
                </thead>

                <tbody>
                  {materials.map((item) => (
                    <tr key={item.id}>
                      <td>{item.material_name}</td>
                      <td>{item.quantity}</td>
                      <td>{item.vendor_name}</td>
                    </tr>
                  ))}

                  {materials.length === 0 && (
                    <tr>
                      <td colSpan="2">No materials found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="panel">
              <h2>Bank Details</h2>

              <table>
                <thead>
                  <tr>
                    <th>Bank</th>
                    <th>Account Name</th>
                    <th>Account Number</th>
                  </tr>
                </thead>

                <tbody>
                  {banking.map((bank) => (
                    <tr key={bank.id}>
                      <td>{bank.bank_name}</td>
                      <td>{bank.account_name}</td>
                      <td>{bank.account_number}</td>
                    </tr>
                  ))}

                  {banking.length === 0 && (
                    <tr>
                      <td colSpan="2">No banking details found.</td>
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
                    <th>Site</th>
                    <th>Notes</th>
                    <th>Photo</th>
                  </tr>
                </thead>

                <tbody>
                  {updates.map((update) => (
                    <tr key={update.id}>
                      <td>{update.log_date?.slice(0, 10)}</td>
                      <td>{update.site_name}</td>
                      <td>{update.notes}</td>
                      <td>
                      {update.photo_url ? (
                        <>
                            <a
                            href={update.photo_url}
                            target="_blank"
                            rel="noreferrer"
                            >
                            Open
                            </a>

                            <br />

                            <img
                            src={update.photo_url}
                            alt="Site Update"
                            style={{
                                width: "120px",
                                borderRadius: "8px",
                                marginTop: "8px",
                            }}
                            />
                        </>
                        ) : (
                        "No photo"
                        )}
                      </td>
                    </tr>
                  ))}

                  {updates.length === 0 && (
                    <tr>
                      <td colSpan="3">No updates found.</td>
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