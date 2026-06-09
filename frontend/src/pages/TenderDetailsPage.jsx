import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getTenderDetails,
  addTenderMaterial,
  deleteTenderMaterial,
  addTenderBanking,
  deleteTenderBanking,
  addTenderDocument,
  deleteTenderDocument,
  uploadFile,
} from "../services/tenderDetailsService";

function TenderDetailsPage() {
  const { id } = useParams();

  const [activeTab, setActiveTab] = useState("documents");
  const [loading, setLoading] = useState(true);

  const [tender, setTender] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [banking, setBanking] = useState([]);
  const [dailyUpdates, setDailyUpdates] = useState([]);
  const [subcontractors, setSubcontractors] = useState([]);

  const [documentForm, setDocumentForm] = useState({
    document_name: "",
    document_type: "PDF",
    file_url: "",
  });

  const [selectedFile, setSelectedFile] = useState(null);

  const [materialForm, setMaterialForm] = useState({
    section_name: "",
    material_name: "",
    quantity: "",
    unit: "",
    rate: "",
    notes: "",
  });

  const [bankingForm, setBankingForm] = useState({
    payment_type: "",
    bank_name: "",
    account_name: "",
    account_number: "",
    amount: "",
    gst_amount: "",
    notes: "",
    payment_date: "",
  });

  const fetchTenderDetails = async () => {
    try {
      setLoading(true);
      const data = await getTenderDetails(id);

      setTender(data.tender);
      setDocuments(data.documents || []);
      setMaterials(data.materials || []);
      setBanking(data.banking || []);
      setDailyUpdates(data.dailyUpdates || []);
      setSubcontractors(data.subcontractors || []);
    } catch (error) {
      console.error("Tender details fetch error:", error);
      alert("Failed to load tender details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenderDetails();
  }, [id]);

  const handleAddDocument = async (e) => {
    e.preventDefault();
  
    let uploadedUrl = documentForm.file_url;
  
    if (selectedFile) {
      const uploadResult = await uploadFile(selectedFile);
      uploadedUrl = uploadResult.fileUrl;
    }
  
    await addTenderDocument({
      tender_id: id,
      document_name: documentForm.document_name,
      document_type: documentForm.document_type,
      file_url: uploadedUrl,
      uploaded_by: 1,
    });
  
    setDocumentForm({
      document_name: "",
      document_type: "PDF",
      file_url: "",
    });
  
    setSelectedFile(null);
  
    fetchTenderDetails();
  };

  const handleAddMaterial = async (e) => {
    e.preventDefault();

    await addTenderMaterial({
      tender_id: id,
      ...materialForm,
    });

    setMaterialForm({
      section_name: "",
      material_name: "",
      quantity: "",
      unit: "",
      rate: "",
      notes: "",
    });

    fetchTenderDetails();
  };

  const handleAddBanking = async (e) => {
    e.preventDefault();

    await addTenderBanking({
      tender_id: id,
      ...bankingForm,
    });

    setBankingForm({
      payment_type: "",
      bank_name: "",
      account_name: "",
      account_number: "",
      amount: "",
      gst_amount: "",
      notes: "",
      payment_date: "",
    });

    fetchTenderDetails();
  };

  if (loading) {
    return <div style={{ padding: "24px" }}>Loading tender details...</div>;
  }

  if (!tender) {
    return <div style={{ padding: "24px" }}>Tender not found</div>;
  }

  return (
    <div style={{ padding: "24px" }}>
      <h1>{tender.title}</h1>
      <p>
        Status: {tender.status} | Due Date: {tender.due_date || "N/A"}
      </p>
      <p>
        Site: {tender.site_name || "N/A"} | {tender.address || ""}
      </p>

      <div style={{ display: "flex", gap: "10px", margin: "20px 0" }}>
        {["documents", "materials", "banking", "daily", "subcontractors"].map(
          (tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "10px 14px",
                border: "1px solid #ccc",
                background: activeTab === tab ? "#111827" : "#fff",
                color: activeTab === tab ? "#fff" : "#111827",
                cursor: "pointer",
              }}
            >
              {tab.toUpperCase()}
            </button>
          )
        )}
      </div>

      {activeTab === "documents" && (
        <section>
          <h2>Documents</h2>

          <form onSubmit={handleAddDocument}>
            <input
              placeholder="Document name"
              value={documentForm.document_name}
              onChange={(e) =>
                setDocumentForm({
                  ...documentForm,
                  document_name: e.target.value,
                })
              }
            />

            <select
              value={documentForm.document_type}
              onChange={(e) =>
                setDocumentForm({
                  ...documentForm,
                  document_type: e.target.value,
                })
              }
            >
              <option>PDF</option>
              <option>Word</option>
              <option>JPG</option>
              <option>PNG</option>
            </select>

            <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => setSelectedFile(e.target.files[0])}
            />

            <input
                placeholder="Optional file URL"
                value={documentForm.file_url}
                onChange={(e) =>
                    setDocumentForm({
                        ...documentForm,
                        file_url: e.target.value,
                    })
                }
            />

            <button type="submit">Add Document</button>
          </form>

          <table width="100%" border="1" cellPadding="8">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>File</th>
                <th>Action</th>
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
                      "No file"
                    )}
                  </td>
                  <td>
                    <button
                      onClick={async () => {
                        await deleteTenderDocument(doc.id);
                        fetchTenderDetails();
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {activeTab === "materials" && (
        <section>
          <h2>Material Data</h2>

          <form onSubmit={handleAddMaterial}>
            <input
              placeholder="Section e.g. Cement, Steel"
              value={materialForm.section_name}
              onChange={(e) =>
                setMaterialForm({
                  ...materialForm,
                  section_name: e.target.value,
                })
              }
            />

            <input
              placeholder="Material name"
              value={materialForm.material_name}
              onChange={(e) =>
                setMaterialForm({
                  ...materialForm,
                  material_name: e.target.value,
                })
              }
            />

            <input
              placeholder="Quantity"
              type="number"
              value={materialForm.quantity}
              onChange={(e) =>
                setMaterialForm({
                  ...materialForm,
                  quantity: e.target.value,
                })
              }
            />

            <input
              placeholder="Unit"
              value={materialForm.unit}
              onChange={(e) =>
                setMaterialForm({
                  ...materialForm,
                  unit: e.target.value,
                })
              }
            />

            <input
              placeholder="Rate"
              type="number"
              value={materialForm.rate}
              onChange={(e) =>
                setMaterialForm({
                  ...materialForm,
                  rate: e.target.value,
                })
              }
            />

            <input
              placeholder="Notes"
              value={materialForm.notes}
              onChange={(e) =>
                setMaterialForm({
                  ...materialForm,
                  notes: e.target.value,
                })
              }
            />

            <button type="submit">Add Material</button>
          </form>

          <table width="100%" border="1" cellPadding="8">
            <thead>
              <tr>
                <th>Section</th>
                <th>Material</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Rate</th>
                <th>Total</th>
                <th>Notes</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((item) => (
                <tr key={item.id}>
                  <td>{item.section_name}</td>
                  <td>{item.material_name}</td>
                  <td>{item.quantity}</td>
                  <td>{item.unit}</td>
                  <td>{item.rate}</td>
                  <td>{item.total_amount}</td>
                  <td>{item.notes}</td>
                  <td>
                    <button
                      onClick={async () => {
                        await deleteTenderMaterial(item.id);
                        fetchTenderDetails();
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {activeTab === "banking" && (
        <section>
          <h2>Banking / Payments</h2>

          <form onSubmit={handleAddBanking}>
            <input
              placeholder="Payment type"
              value={bankingForm.payment_type}
              onChange={(e) =>
                setBankingForm({
                  ...bankingForm,
                  payment_type: e.target.value,
                })
              }
            />

            <input
              placeholder="Bank name"
              value={bankingForm.bank_name}
              onChange={(e) =>
                setBankingForm({
                  ...bankingForm,
                  bank_name: e.target.value,
                })
              }
            />

            <input
              placeholder="Account name"
              value={bankingForm.account_name}
              onChange={(e) =>
                setBankingForm({
                  ...bankingForm,
                  account_name: e.target.value,
                })
              }
            />

            <input
              placeholder="Account number"
              value={bankingForm.account_number}
              onChange={(e) =>
                setBankingForm({
                  ...bankingForm,
                  account_number: e.target.value,
                })
              }
            />

            <input
              placeholder="Amount"
              type="number"
              value={bankingForm.amount}
              onChange={(e) =>
                setBankingForm({
                  ...bankingForm,
                  amount: e.target.value,
                })
              }
            />

            <input
              placeholder="GST Amount"
              type="number"
              value={bankingForm.gst_amount}
              onChange={(e) =>
                setBankingForm({
                  ...bankingForm,
                  gst_amount: e.target.value,
                })
              }
            />

            <input
              type="date"
              value={bankingForm.payment_date}
              onChange={(e) =>
                setBankingForm({
                  ...bankingForm,
                  payment_date: e.target.value,
                })
              }
            />

            <input
              placeholder="Notes"
              value={bankingForm.notes}
              onChange={(e) =>
                setBankingForm({
                  ...bankingForm,
                  notes: e.target.value,
                })
              }
            />

            <button type="submit">Add Banking Entry</button>
          </form>

          <table width="100%" border="1" cellPadding="8">
            <thead>
              <tr>
                <th>Type</th>
                <th>Bank</th>
                <th>Account</th>
                <th>Amount</th>
                <th>GST</th>
                <th>Date</th>
                <th>Notes</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {banking.map((item) => (
                <tr key={item.id}>
                  <td>{item.payment_type}</td>
                  <td>{item.bank_name}</td>
                  <td>{item.account_name}</td>
                  <td>{item.amount}</td>
                  <td>{item.gst_amount}</td>
                  <td>{item.payment_date}</td>
                  <td>{item.notes}</td>
                  <td>
                    <button
                      onClick={async () => {
                        await deleteTenderBanking(item.id);
                        fetchTenderDetails();
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {activeTab === "daily" && (
        <section>
          <h2>Daily Progress</h2>

          <table width="100%" border="1" cellPadding="8">
            <thead>
              <tr>
                <th>Date</th>
                <th>Worker</th>
                <th>Notes</th>
                <th>Photo</th>
              </tr>
            </thead>
            <tbody>
              {dailyUpdates.map((log) => (
                <tr key={log.id}>
                  <td>{log.log_date}</td>
                  <td>{log.worker_name || "N/A"}</td>
                  <td>{log.notes}</td>
                  <td>
                    {log.photo_url ? (
                      <a href={log.photo_url} target="_blank" rel="noreferrer">
                        Open Photo
                      </a>
                    ) : (
                      "No photo"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {activeTab === "subcontractors" && (
        <section>
          <h2>Subcontractors</h2>

          <table width="100%" border="1" cellPadding="8">
            <thead>
              <tr>
                <th>Name</th>
                <th>Business</th>
                <th>Phone</th>
                <th>Work</th>
                <th>Assigned Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {subcontractors.map((sub) => (
                <tr key={sub.id}>
                  <td>{sub.full_name}</td>
                  <td>{sub.business_name}</td>
                  <td>{sub.phone}</td>
                  <td>{sub.work_description}</td>
                  <td>{sub.assigned_amount}</td>
                  <td>{sub.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

export default TenderDetailsPage;