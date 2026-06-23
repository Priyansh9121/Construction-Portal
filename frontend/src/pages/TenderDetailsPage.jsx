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
  updateTenderSubcontractor,
} from "../services/tenderDetailsService";

import {
  getTenderFinanceRecords,
  getTenderFinanceSummary,
  createFinanceRecord,
  updateFinanceRecord,
  deleteFinanceRecord,
} from "../services/tenderFinanceService";

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


  const [financeRecords, setFinanceRecords] = useState([]);
  const [financeSummary, setFinanceSummary] = useState(null);
  const [editingFinance, setEditingFinance] = useState(null);
  const [financeForm, setFinanceForm] = useState({
    record_type: "GOVERNMENT_BILL",
    source_name: "",
    payment_mode: "Bank",
    amount: "",
    interest_percent: "",
    gst_percent: "18",
    gst_total: "",
    gst_done: "",
    company_charge_percent: "",
    company_charge_total: "",
    company_charge_done: "",
    tds_amount: "",
    record_date: "",
    notes: "",
  });

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingAssignedSub, setEditingAssignedSub] = useState(null);

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
    vendor_name: "",
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

      try {
        const subData = await getSubcontractors();
        setAllSubcontractors(subData.subcontractors || []);
      } catch (subError) {
        console.error("Subcontractors fetch error:", subError);
        setAllSubcontractors([]);
      }
    } catch (error) {
      console.error("Tender details fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadFinanceData = async () => {
    try {
      const recordsRes = await getTenderFinanceRecords(id);
      const summaryRes = await getTenderFinanceSummary(id);
  
      setFinanceRecords(recordsRes.records || []);
      setFinanceSummary(summaryRes.summary || null);
    } catch (error) {
      console.error("Load finance data error:", error);
    }
  };

  useEffect(() => {
    fetchTenderDetails();
    loadFinanceData();
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
      vendor_name: "",
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

  const handleAddFinanceRecord = async (e) => {
    e.preventDefault();
  
    if (
      financeForm.record_type === "GST_RETURN" &&
      Number(financeForm.amount) > Number(financeSummary?.gst_left || 0)
    ) {
      alert("GST Return cannot be greater than remaining GST.");
      return;
    }
  
    if (
      financeForm.record_type === "COMPANY_CHARGE_PAYMENT" &&
      Number(financeForm.amount) >
        Number(financeSummary?.company_charge_left || 0)
    ) {
      alert(
        "Company Charge Payment cannot be greater than remaining Company Charge."
      );
      return;
    }
  
    const payload = {
      site_id: tender?.site_id || null,
      tender_id: id,
      ...financeForm,
  
      amount: Number(financeForm.amount || 0),
      interest_percent: Number(financeForm.interest_percent || 0),
  
      gst_percent: Number(financeForm.gst_percent || 0),
      gst_total:
        financeForm.record_type === "GOVERNMENT_BILL"
          ? calculatedGstTotal
          : 0,
      gst_done:
        financeForm.record_type === "GST_RETURN"
          ? Number(financeForm.amount || 0)
          : Number(financeForm.gst_done || 0),
  
      company_charge_percent: Number(financeForm.company_charge_percent || 0),
      company_charge_total:
        financeForm.record_type === "COMPANY_CHARGE"
          ? calculatedCompanyChargeTotal
          : 0,
      company_charge_done:
        financeForm.record_type === "COMPANY_CHARGE_PAYMENT"
          ? Number(financeForm.amount || 0)
          : Number(financeForm.company_charge_done || 0),
  
      tds_amount: Number(financeForm.tds_amount || 0),
    };
  
    if (editingFinance) {
      await updateFinanceRecord(editingFinance.id, payload);
    } else {
      await createFinanceRecord(payload);
    }
  
    setFinanceForm({
      record_type: "GOVERNMENT_BILL",
      source_name: "",
      payment_mode: "Bank",
      amount: "",
      interest_percent: "",
      gst_percent: "18",
      gst_total: "",
      gst_done: "",
      company_charge_percent: "",
      company_charge_total: "",
      company_charge_done: "",
      tds_amount: "",
      record_date: "",
      notes: "",
    });
  
    setEditingFinance(null);
    await loadFinanceData();
  };
  

  const startEditFinanceRecord = (item) => {
    setEditingFinance(item);
  
    setFinanceForm({
      record_type: item.record_type || "GOVERNMENT_BILL",
      source_name: item.source_name || "",
      payment_mode: item.payment_mode || "Bank",
      amount: item.amount ? String(item.amount) : "",
      interest_percent: item.interest_percent ? String(item.interest_percent) : "",
      gst_percent: item.gst_percent ? String(item.gst_percent) : "",
      gst_total: item.gst_total ? String(item.gst_total) : "",
      gst_done: item.gst_done ? String(item.gst_done) : "",
      company_charge_percent: item.company_charge_percent
        ? String(item.company_charge_percent)
        : "",
      company_charge_total: item.company_charge_total
        ? String(item.company_charge_total)
        : "",
      company_charge_done: item.company_charge_done
        ? String(item.company_charge_done)
        : "",
      tds_amount: item.tds_amount ? String(item.tds_amount) : "",
      record_date: item.record_date ? item.record_date.slice(0, 10) : "",
      notes: item.notes || "",
    });
  };

  const handleAssignSubcontractor = async (e) => {
    e.preventDefault();

    if (!subcontractorForm.subcontractor_id) {
      alert("Please select a subcontractor");
      return;
    }

    if (!subcontractorForm.work_description.trim()) {
      alert("Please enter work description");
      return;
    }

    if (
      !subcontractorForm.assigned_amount ||
      Number(subcontractorForm.assigned_amount) <= 0
    ) {
      alert("Please enter assigned amount greater than 0");
      return;
    }

    if (editingAssignedSub) {
      await updateTenderSubcontractor(editingAssignedSub.id, {
        work_description: subcontractorForm.work_description,
        assigned_amount: Number(subcontractorForm.assigned_amount),
        status: subcontractorForm.status,
      });
    } else {
      await assignTenderSubcontractor({
        tender_id: id,
        subcontractor_id: Number(subcontractorForm.subcontractor_id),
        work_description: subcontractorForm.work_description,
        assigned_amount: Number(subcontractorForm.assigned_amount),
        status: subcontractorForm.status,
      });
    }

    setSubcontractorForm({
      subcontractor_id: "",
      work_description: "",
      assigned_amount: "",
      status: "active",
    });

    setEditingAssignedSub(null);
    fetchTenderDetails();
  };

  const startEditAssignedSubcontractor = (sub) => {
    setEditingAssignedSub(sub);

    setSubcontractorForm({
      subcontractor_id: sub.subcontractor_id,
      work_description: sub.work_description || "",
      assigned_amount: sub.assigned_amount || "",
      status: sub.status || "active",
    });
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

    if (deleteTarget.type === "finance") {
      await deleteFinanceRecord(deleteTarget.item.id);
      await loadFinanceData();
    }

    setDeleteTarget(null);
    fetchTenderDetails();
  };

  const materialTotal = materials.reduce(
    (sum, item) => sum + Number(item.total_amount || 0),
    0
  );

  const subcontractorAssignedTotal = subcontractors.reduce(
    (sum, sub) => sum + Number(sub.assigned_amount || 0),
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

  const subcontractorCost = subcontractors.reduce(
    (sum, sub) => sum + Number(sub.assigned_amount || 0),
    0
  );

  const materialCost = materials.reduce(
    (sum, item) => sum + Number(item.total_amount || 0),
    0
  );

  const bankingCost = banking
    .filter((item) =>
      [
        "subcontractor_payment",
        "material_payment",
        "gst_payment",
        "third_party_payment",
        "other",
      ].includes(item.payment_type)
    )
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const tenderIncome = banking
    .filter((item) =>
      ["government_payment", "company_returned"].includes(item.payment_type)
    )
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const totalTenderCost = materialCost + subcontractorCost + bankingCost;
  const tenderValue = Number(tender?.estimated_value || 0);
  const remainingBudget = tenderValue - totalTenderCost;
  const tenderProfit = tenderIncome - totalTenderCost;

  const tenderProfitPercentage =
    tenderIncome > 0 ? (tenderProfit / tenderIncome) * 100 : 0;


  
  const financeAmount = Number(financeForm.amount || 0);
  const financeGstPercent = Number(financeForm.gst_percent || 0);
  const financeCompanyPercent = Number(financeForm.company_charge_percent || 0);
    
  const calculatedGstTotal =
    financeForm.record_type === "GOVERNMENT_BILL"
      ? (financeAmount * financeGstPercent) / 100
      : Number(financeForm.gst_total || 0);
  
  const calculatedCompanyChargeTotal =
    financeForm.record_type === "COMPANY_CHARGE"
      ? (financeAmount * financeCompanyPercent) / 100
      : Number(financeForm.company_charge_total || 0);
  
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "documents", label: "Documents" },
    { key: "materials", label: "Materials" },
    { key: "banking", label: "Banking" },
    { key: "finance", label: "Finance" },
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
          <>
            <div className="summary-cards">
              <div className="card">
                <p>Tender Value</p>
                <h2>${tenderValue.toFixed(2)}</h2>
              </div>

              <div className="card">
                <p>Remaining Budget</p>
                <h2>${remainingBudget.toFixed(2)}</h2>
              </div>

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

              <div className="card">
                <p>Tender Income</p>
                <h2>${tenderIncome.toFixed(2)}</h2>
              </div>

              <div className="card">
                <p>Total Cost</p>
                <h2>${totalTenderCost.toFixed(2)}</h2>
              </div>

              <div className="card">
                <p>Profit / Loss</p>
                <h2>${tenderProfit.toFixed(2)}</h2>
              </div>

              <div className="card">
                <p>Profit %</p>
                <h2>{tenderProfitPercentage.toFixed(2)}%</h2>
              </div>

              <div
                className="card"
                style={{
                  background: "#fff3cd",
                  border: "2px solid #ffc107",
                }}
              >
                <p style={{ fontWeight: "bold", color: "#856404" }}>
                  Baki GST
                </p>

                <h2 style={{ color: "#dc3545" }}>
                  ${Number(financeSummary?.gst_left || 0).toFixed(2)}
                </h2>
              </div>

              <div
                className="card"
                style={{
                  background: "#ffe5e5",
                  border: "2px solid #dc3545",
                }}
              >
                <p style={{ fontWeight: "bold", color: "#dc3545" }}>
                  Baki Company Charge
                </p>

                <h2 style={{ color: "#dc3545" }}>
                  ${Number(financeSummary?.company_charge_left || 0).toFixed(2)}
                </h2>
              </div>

              <div
                className="card"
                style={{
                  background: "#e8f5e9",
                  border: "2px solid #28a745",
                }}
              >
                <p style={{ fontWeight: "bold" }}>
                  Overall Done
                </p>

                <h2 style={{ color: "#28a745" }}>
                  ${Number(financeSummary?.overall_done || 0).toFixed(2)}
                </h2>
              </div>

              <div
                className="card"
                style={{
                  background: "#fff3cd",
                  border: "2px solid #fd7e14",
                }}
              >
                <p style={{ fontWeight: "bold", color: "#fd7e14" }}>
                  Overall Left
                </p>

                <h2 style={{ color: "#fd7e14" }}>
                  ${Number(financeSummary?.overall_left || 0).toFixed(2)}
                </h2>
              </div>
            </div>

            <div className="panel">
              <h2>Tender Profit Breakdown</h2>

              <table>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Amount</th>
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    <td>Tender Value</td>
                    <td>${tenderValue.toFixed(2)}</td>
                  </tr>

                  <tr>
                    <td>Remaining Budget</td>
                    <td>${remainingBudget.toFixed(2)}</td>
                  </tr>

                  <tr>
                    <td>Tender Income</td>
                    <td>${tenderIncome.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Remaining Budget</td>
                    <td>${remainingBudget.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Material Cost</td>
                    <td>${materialCost.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Subcontractor Cost</td>
                    <td>${subcontractorCost.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Banking/Other Cost</td>
                    <td>${bankingCost.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Total Cost</td>
                    <td>${totalTenderCost.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Profit / Loss</td>
                    <td>${tenderProfit.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Profit Percentage</td>
                    <td>{tenderProfitPercentage.toFixed(2)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
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
                <select
                  value={materialForm.section_name}
                  onChange={(e) =>
                    setMaterialForm({
                      ...materialForm,
                      section_name: e.target.value,
                    })
                  }
                  required
                >
                  <option value="">Select Material Category</option>
                  <option value="Steel">Steel</option>
                  <option value="Sand">Sand</option>
                  <option value="Cement">Cement</option>
                  <option value="Kapchi">Kapchi</option>
                  <option value="Crushed Stone">Crushed Stone</option>
                  <option value="Tiles">Tiles</option>
                  <option value="Pipe">Pipe</option>
                  <option value="Blocks">Blocks</option>
                  <option value="Wood">Wood</option>
                  <option value="Other">Other</option>
                </select>

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

                <input
                  placeholder="Vendor / Supplier Name"
                  value={materialForm.vendor_name}
                  onChange={(e) =>
                    setMaterialForm({
                      ...materialForm,
                      vendor_name: e.target.value,
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
                    <th>Vendor</th>
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
                      <td>{item.vendor_name}</td>
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
                      <td colSpan="9">No materials added yet.</td>
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

        {activeTab === "finance" && (
          <>
            <div className="summary-cards">
              <div className="card">
                <p>GST Total</p>
                <h2>
                  $
                  {Number(financeSummary?.gst_total || 0).toFixed(2)}
                </h2>
              </div>

              <div className="card">
                <p>GST Done</p>
                <h2>
                  ${Number(financeSummary?.gst_done || 0).toFixed(2)}
                </h2>
              </div>

              <div
                className="stat-card"
                style={{
                  background: "#fff3cd",
                  border: "2px solid #ffc107",
                }}
              >
                <p style={{ color: "#856404", fontWeight: "bold" }}>
                  Baki GST
                </p>

                <h2
                  style={{
                    color: "#dc3545",
                    fontWeight: "bold",
                  }}
                >
                  ${Number(financeSummary?.gst_left || 0).toFixed(2)}
                </h2>
              </div>

              <div className="card">
                <p>Company Charge</p>
                <h2>
                  $
                  {Number(financeSummary?.company_charge_total || 0).toFixed(2)}
                </h2>
              </div>

              <div className="card">
                <p>Company Charge Done</p>
                <h2>
                  ${Number(financeSummary?.company_charge_done || 0).toFixed(2)}
                </h2>
              </div>

              <div
                className="stat-card"
                style={{
                  background: "#ffe5e5",
                  border: "2px solid #dc3545",
                }}
              >
                <p style={{ color: "#dc3545", fontWeight: "bold" }}>
                  Baki Company Charge
                </p>

                <h2
                  style={{
                    color: "#dc3545",
                    fontWeight: "bold",
                  }}
                >
                  ${Number(financeSummary?.company_charge_left || 0).toFixed(2)}
                </h2>
              </div>
              <div className="stat-card">
                <p>Overall Total</p>
                <h2>
                  ${Number(financeSummary?.overall_total || 0).toFixed(2)}
                </h2>
              </div>

              <div className="stat-card">
                <p>Overall Done</p>
                <h2>
                  ${Number(financeSummary?.overall_done || 0).toFixed(2)}
                </h2>
              </div>

              <div
                className="stat-card"
                style={{
                  background: "#e8f5e9",
                  border: "2px solid #28a745",
                }}
              >
                <p style={{ fontWeight: "bold" }}>
                  Overall Left
                </p>

                <h2
                  style={{
                    color: "#28a745",
                    fontWeight: "bold",
                  }}
                >
                  ${Number(financeSummary?.overall_left || 0).toFixed(2)}
                </h2>
              </div>
            </div>

          

            <div className="payment-grid">
              <div className="panel">
                <h2>{editingFinance ? "Edit Finance Record" : "Add Finance Record"}</h2>

                <form
                  className="payment-form"
                  onSubmit={handleAddFinanceRecord}
                >
                  <select
                    value={financeForm.record_type}
                    onChange={(e) => {
                      const type = e.target.value;
                    
                      setFinanceForm({
                        ...financeForm,
                        record_type: type,
                        gst_percent: type === "GOVERNMENT_BILL" ? "18" : "",
                        company_charge_percent: type === "COMPANY_CHARGE" ? "2" : "",
                        gst_total: "",
                        company_charge_total: "",
                      });
                    }}
                  >
                    <option value="INVESTOR">Investor</option>
                    <option value="GOVERNMENT_BILL">
                      Government Bill
                    </option>
                    <option value="SUBCONTRACTOR">
                      Subcontractor
                    </option>
                    <option value="OFFICE">Office</option>
                    <option value="COMPANY_CHARGE">
                      Company Charge
                    </option>

                    <option value="COMPANY_CHARGE_PAYMENT">
                      Company Charge Payment
                    </option>
                    <option value="TDS">TDS</option>
                    <option value="GST_RETURN">
                      GST Return
                    </option>
                  </select>

                  

                  <input
                    placeholder={
                      financeForm.record_type === "INVESTOR"
                        ? "Investor Name"
                        : financeForm.record_type === "OFFICE"
                        ? "Source / Company Name"
                        : "Source Name"
                    }
                    value={financeForm.source_name}
                    onChange={(e) =>
                      setFinanceForm({
                        ...financeForm,
                        source_name: e.target.value,
                      })
                    }
                  />

                  <select
                    value={financeForm.payment_mode}
                    onChange={(e) =>
                      setFinanceForm({
                        ...financeForm,
                        payment_mode: e.target.value,
                      })
                    }
                  >
                    <option value="Bank">Bank</option>
                    <option value="Cash">Cash</option>
                  </select>

                  <input
                    placeholder="Amount"
                    type="number"
                    value={financeForm.amount}
                    onChange={(e) =>
                      setFinanceForm({
                        ...financeForm,
                        amount: e.target.value,
                      })
                    }
                  />

                  {financeForm.record_type === "INVESTOR" && (
                    <input
                      placeholder="Interest %"
                      type="number"
                      value={financeForm.interest_percent}
                      onChange={(e) =>
                        setFinanceForm({
                          ...financeForm,
                          interest_percent: e.target.value,
                        })
                      }
                    />
                  )}

                  {financeForm.record_type === "GOVERNMENT_BILL" && (
                    <>
                      <input
                        placeholder="GST %"
                        type="number"
                        value={financeForm.gst_percent}
                        onChange={(e) =>
                          setFinanceForm({
                            ...financeForm,
                            gst_percent: e.target.value,
                          })
                        }
                      />

                      <p className="form-preview-total">
                        GST Total: ${calculatedGstTotal.toFixed(2)}
                      </p>
                    </>
                  )}

                 

                  {financeForm.record_type === "COMPANY_CHARGE" && (
                    <>
                      <input
                        placeholder="Company Charge %"
                        type="number"
                        value={financeForm.company_charge_percent}
                        onChange={(e) =>
                          setFinanceForm({
                            ...financeForm,
                            company_charge_percent: e.target.value,
                          })
                        }
                      />

                      <p className="form-preview-total">
                        Company Charge: ${calculatedCompanyChargeTotal.toFixed(2)}
                      </p>
                    </>
                  )}


                  <input
                    type="date"
                    value={financeForm.record_date}
                    onChange={(e) =>
                      setFinanceForm({
                        ...financeForm,
                        record_date: e.target.value,
                      })
                    }
                  />

                  <input
                    placeholder="Notes"
                    value={financeForm.notes}
                    onChange={(e) =>
                      setFinanceForm({
                        ...financeForm,
                        notes: e.target.value,
                      })
                    }
                  />

                  <button type="submit">
                    {editingFinance
                      ? "Save Finance Record"
                      : "Add Finance Record"}
                  </button>
                </form>
              </div>

              <div className="panel">
                <h2>Finance Records</h2>

                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Source</th>
                      <th>Amount</th>
                      <th>GST</th>
                      <th>Company Charge</th>
                      <th>Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {financeRecords.map((item) => (
                      <tr key={item.id}>
                        <td>{item.record_type}</td>
                        <td>{item.source_name}</td>
                        <td>${item.amount}</td>
                        <td>${item.gst_total}</td>
                        <td>
                          ${item.company_charge_total}
                        </td>
                        <td>
                          {item.record_date?.slice(0, 10)}
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => startEditFinanceRecord(item)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="delete-btn"
                            onClick={() =>
                              setDeleteTarget({
                                type: "finance",
                                item,
                              })
                            }
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}

                    {financeRecords.length === 0 && (
                      <tr>
                        <td colSpan="7">
                          No finance records yet.
                        </td>
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
          <>
            <div className="summary-cards">
              <div className="card">
                <p>Assigned Subcontractors</p>
                <h2>{subcontractors.length}</h2>
              </div>

              <div className="card">
                <p>Total Assigned Amount</p>
                <h2>${subcontractorAssignedTotal.toFixed(2)}</h2>
              </div>
            </div>

            <div className="payment-grid">
              <div className="panel">
                <h2>
                  {editingAssignedSub
                    ? "Edit Assigned Subcontractor"
                    : "Assign Subcontractor"}
                </h2>

                <form
                  className="payment-form"
                  onSubmit={handleAssignSubcontractor}
                >
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

                  <button type="submit">
                    {editingAssignedSub ? "Save Changes" : "Assign to Tender"}
                  </button>

                  {editingAssignedSub && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAssignedSub(null);
                        setSubcontractorForm({
                          subcontractor_id: "",
                          work_description: "",
                          assigned_amount: "",
                          status: "active",
                        });
                      }}
                    >
                      Cancel
                    </button>
                  )}
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
                        <td>${Number(sub.assigned_amount).toFixed(2)}</td>
                        <td>{sub.status}</td>

                        <td
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              startEditAssignedSubcontractor(sub)
                            }
                          >
                            Edit
                          </button>

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
          </>
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