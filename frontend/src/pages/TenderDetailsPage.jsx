import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import DeleteVerificationModal from "../components/DeleteVerificationModal";

import {
  getTenderDetails,
  addTenderMaterial,
  deleteTenderMaterial,
  addTenderBanking,
  deleteTenderBanking,
  addTenderDocument,
  deleteTenderDocument,
  uploadFile,
  assignTenderSubcontractor,
  removeTenderSubcontractor,
} from "../services/tenderDetailsService";

import { getSubcontractors } from "../services/subcontractorService";

function TenderDetailsPage() {
  const { id } = useParams();

  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  const [tender, setTender] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [banking, setBanking] = useState([]);
  const [dailyUpdates, setDailyUpdates] = useState([]);
  const [subcontractors, setSubcontractors] = useState([]);
  const [allSubcontractors, setAllSubcontractors] = useState([]);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const [subcontractorForm, setSubcontractorForm] = useState({
    subcontractor_id: "",
    work_description: "",
    assigned_amount: "",
    status: "active",
  });

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

      const subData = await getSubcontractors();
      setAllSubcontractors(subData.subcontractors || []);
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
      file_url: uploadedUrl || null,
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

  const handleAssignSubcontractor = async (e) => {
    e.preventDefault();

    await assignTenderSubcontractor({
      tender_id: id,
      subcontractor_id: Number(subcontractorForm.subcontractor_id),
      work_description: subcontractorForm.work_description,
      assigned_amount: Number(subcontractorForm.assigned_amount || 0),
      status: subcontractorForm.status,
    });

    setSubcontractorForm({
      subcontractor_id: "",
      work_description: "",
      assigned_amount: "",
      status: "active",
    });

    fetchTenderDetails();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === "document") {
      await deleteTenderDocument(deleteTarget.item.id);
    }

    if (deleteTarget.type === "material") {
      await deleteTenderMaterial(deleteTarget.item.id);
    }

    if (deleteTarget.type === "banking") {
      await deleteTenderBanking(deleteTarget.item.id);
    }

    if (deleteTarget.type === "subcontractor") {
      await removeTenderSubcontractor(deleteTarget.item.id);
    }

    setDeleteTarget(null);
    fetchTenderDetails();
  };

  const materialTotal = materials.reduce(
    (sum, item) => sum + Number(item.total_amount || 0),
    0
  );

  const bankingTotal = banking.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const gstTotal = banking.reduce(
    (sum, item) => sum + Number(item.gst_amount || 0),
    0
  );

  const loanedTotal = banking
    .filter((item) => item.payment_type === "loaned_amount")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const returnedTotal = banking
    .filter((item) => item.payment_type === "company_returned")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "documents", label: "Documents" },
    { key: "materials", label: "Materials" },
    { key: "banking", label: "Banking" },
    { key: "daily", label: "Daily Progress" },
    { key: "subcontractors", label: "Subcontractors" },
  ];

  if (loading) {
    return <div className="panel">Loading tender details...</div>;
  }

  if (!tender) {
    return <div className="panel">Tender not found</div>;
  }

  return (
    <>
      <section className="tender-details-page">
        <div className="panel tender-header">
          <div>
            <h2>{tender.title}</h2>
            <p>Status: {tender.status}</p>
            <p>
              Due Date:{" "}
              {tender.due_date ? tender.due_date.slice(0, 10) : "N/A"}
            </p>
            <p>
              Site: {tender.site_name || "N/A"}{" "}
              {tender.address ? `| ${tender.address}` : ""}
            </p>
          </div>
        </div>

        <div className="tender-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? "active-tab" : ""}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="summary-cards">
            <div className="card">
              <p>Documents</p>
              <h2>{documents.length}</h2>
            </div>

            <div className="card">
              <p>Material Total</p>
              <h2>${materialTotal.toFixed(2)}</h2>
            </div>

            <div className="card">
              <p>Banking Total</p>
              <h2>${bankingTotal.toFixed(2)}</h2>
            </div>

            <div className="card">
              <p>Daily Updates</p>
              <h2>{dailyUpdates.length}</h2>
            </div>
          </div>
        )}

        {activeTab === "documents" && (
          <div className="payment-grid">
            <div className="panel">
              <h2>Add Document</h2>

              <form className="payment-form" onSubmit={handleAddDocument}>
                <input
                  placeholder="Document name"
                  value={documentForm.document_name}
                  onChange={(e) =>
                    setDocumentForm({
                      ...documentForm,
                      document_name: e.target.value,
                    })
                  }
                  required
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
            </div>

            <div className="panel">
              <h2>Documents List</h2>

              <table>
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
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open
                          </a>
                        ) : (
                          "No file"
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="delete-btn"
                          onClick={() =>
                            setDeleteTarget({
                              type: "document",
                              item: doc,
                            })
                          }
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}

                  {documents.length === 0 && (
                    <tr>
                      <td colSpan="4">No documents added yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "materials" && (
          <div className="payment-grid">
            <div className="panel">
              <h2>Add Material</h2>

              <form className="payment-form" onSubmit={handleAddMaterial}>
                <input
                  placeholder="Section e.g. Cement, Steel"
                  value={materialForm.section_name}
                  onChange={(e) =>
                    setMaterialForm({
                      ...materialForm,
                      section_name: e.target.value,
                    })
                  }
                  required
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
                  required
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

                <p className="form-preview-total">
                  Total: $
                  {(
                    Number(materialForm.quantity || 0) *
                    Number(materialForm.rate || 0)
                  ).toFixed(2)}
                </p>

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
            </div>

            <div className="panel">
              <h2>Material Data</h2>

              <table>
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
                          type="button"
                          className="delete-btn"
                          onClick={() =>
                            setDeleteTarget({
                              type: "material",
                              item,
                            })
                          }
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}

                  {materials.length === 0 && (
                    <tr>
                      <td colSpan="8">No materials added yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "banking" && (
          <>
            <div className="summary-cards">
              <div className="card">
                <p>Total Banking</p>
                <h2>${bankingTotal.toFixed(2)}</h2>
              </div>

              <div className="card">
                <p>GST Total</p>
                <h2>${gstTotal.toFixed(2)}</h2>
              </div>

              <div className="card">
                <p>Loaned Amount</p>
                <h2>${loanedTotal.toFixed(2)}</h2>
              </div>

              <div className="card">
                <p>Returned by Company</p>
                <h2>${returnedTotal.toFixed(2)}</h2>
              </div>
            </div>

            <div className="payment-grid">
              <div className="panel">
                <h2>Add Banking Entry</h2>

                <form className="payment-form" onSubmit={handleAddBanking}>
                  <select
                    value={bankingForm.payment_type}
                    onChange={(e) =>
                      setBankingForm({
                        ...bankingForm,
                        payment_type: e.target.value,
                      })
                    }
                    required
                  >
                    <option value="">Select Payment Type</option>
                    <option value="government_payment">
                      Government Payment
                    </option>
                    <option value="company_returned">
                      Returned by Company
                    </option>
                    <option value="loaned_amount">Loaned Amount</option>
                    <option value="third_party_payment">
                      Third Party Payment
                    </option>
                    <option value="gst_payment">GST Payment</option>
                    <option value="subcontractor_payment">
                      Subcontractor Payment
                    </option>
                    <option value="material_payment">Material Payment</option>
                    <option value="other">Other</option>
                  </select>

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
              </div>

              <div className="panel">
                <h2>Banking / Payments</h2>

                <table>
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
                            type="button"
                            className="delete-btn"
                            onClick={() =>
                              setDeleteTarget({
                                type: "banking",
                                item,
                              })
                            }
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}

                    {banking.length === 0 && (
                      <tr>
                        <td colSpan="8">No banking entries added yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === "daily" && (
          <div className="panel">
            <h2>Daily Progress</h2>

            <table>
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
                        <a
                          href={log.photo_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open Photo
                        </a>
                      ) : (
                        "No photo"
                      )}
                    </td>
                  </tr>
                ))}

                {dailyUpdates.length === 0 && (
                  <tr>
                    <td colSpan="4">No daily progress updates yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "subcontractors" && (
          <div className="payment-grid">
            <div className="panel">
              <h2>Assign Subcontractor</h2>

              <form className="payment-form" onSubmit={handleAssignSubcontractor}>
                <select
                  value={subcontractorForm.subcontractor_id}
                  onChange={(e) =>
                    setSubcontractorForm({
                      ...subcontractorForm,
                      subcontractor_id: e.target.value,
                    })
                  }
                  required
                >
                  <option value="">Select Subcontractor</option>

                  {allSubcontractors.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.full_name}
                      {sub.business_name ? ` - ${sub.business_name}` : ""}
                    </option>
                  ))}
                </select>

                <input
                  placeholder="Work description"
                  value={subcontractorForm.work_description}
                  onChange={(e) =>
                    setSubcontractorForm({
                      ...subcontractorForm,
                      work_description: e.target.value,
                    })
                  }
                />

                <input
                  type="number"
                  placeholder="Assigned amount"
                  value={subcontractorForm.assigned_amount}
                  onChange={(e) =>
                    setSubcontractorForm({
                      ...subcontractorForm,
                      assigned_amount: e.target.value,
                    })
                  }
                />

                <select
                  value={subcontractorForm.status}
                  onChange={(e) =>
                    setSubcontractorForm({
                      ...subcontractorForm,
                      status: e.target.value,
                    })
                  }
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="paused">Paused</option>
                </select>

                <button type="submit">Assign to Tender</button>
              </form>
            </div>

            <div className="panel">
              <h2>Assigned Subcontractors</h2>

              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Business</th>
                    <th>Phone</th>
                    <th>Work</th>
                    <th>Assigned Amount</th>
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
                      <td>{sub.work_description}</td>
                      <td>{sub.assigned_amount}</td>
                      <td>{sub.status}</td>
                      <td>
                        <button
                          type="button"
                          className="delete-btn"
                          onClick={() =>
                            setDeleteTarget({
                              type: "subcontractor",
                              item: sub,
                            })
                          }
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}

                  {subcontractors.length === 0 && (
                    <tr>
                      <td colSpan="7">No subcontractors assigned yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <DeleteVerificationModal
        open={!!deleteTarget}
        itemName={
          deleteTarget?.item?.document_name ||
          deleteTarget?.item?.material_name ||
          deleteTarget?.item?.payment_type ||
          deleteTarget?.item?.full_name ||
          "record"
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

export default TenderDetailsPage;