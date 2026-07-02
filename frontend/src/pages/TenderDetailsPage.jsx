import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import DeleteVerificationModal from "../components/DeleteVerificationModal";

import { tenderDetailsTabs } from "../config/tenderDetailsTabs";

import TenderOverviewTab from "../components/tenderDetails/TenderOverviewTab";
import TenderDocumentsTab from "../components/tenderDetails/TenderDocumentsTab";
import TenderMaterialsTab from "../components/tenderDetails/TenderMaterialsTab";
import TenderBankingTab from "../components/tenderDetails/TenderBankingTab";
import TenderFinanceTab from "../components/tenderDetails/TenderFinanceTab";
import TenderDailyProgressTab from "../components/tenderDetails/TenderDailyProgressTab";
import TenderSubcontractorsTab from "../components/tenderDetails/TenderSubcontractorsTab";
import TenderWorkersTab from "../components/tenderDetails/TenderWorkersTab";

import { getWorkers } from "../services/workerService";

import {
  getTenderWorkers,
  assignWorkerToTender,
  removeTenderWorker,
} from "../services/tenderWorkerService";

import {
  calculateTenderDetailsSummary,
  calculateFinancePreview,
} from "../utils/tenderCalculations";

import {
  emptyFinanceForm,
  emptySubcontractorForm,
  emptyDocumentForm,
  emptyMaterialForm,
  emptyBankingForm,
} from "../config/tenderDetailForms";

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
  const navigate = useNavigate();

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
  const [financeForm, setFinanceForm] = useState(emptyFinanceForm);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingAssignedSub, setEditingAssignedSub] = useState(null);

  const [subcontractorForm, setSubcontractorForm] = useState(
    emptySubcontractorForm
  );

  const [documentForm, setDocumentForm] = useState(emptyDocumentForm);
  const [selectedFile, setSelectedFile] = useState(null);

  const [materialForm, setMaterialForm] = useState(emptyMaterialForm);
  const [bankingForm, setBankingForm] = useState(emptyBankingForm);

  const [workers, setWorkers] = useState([]);
  const [assignedWorkers, setAssignedWorkers] = useState([]);

  const [workerForm, setWorkerForm] = useState({
    worker_id: "",
    notes: "",
    status: "active",
  });

  const loadTenderWorkers = async () => {
    try {
      const data = await getTenderWorkers(id);
      setAssignedWorkers(data.workers || []);
    } catch (error) {
      console.error("Load tender workers error:", error);
    }
  };

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

      try {
        const workerData = await getWorkers();
        setWorkers(workerData || []);
      } catch (workerError) {
        console.error("Workers fetch error:", workerError);
        setWorkers([]);
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
    loadTenderWorkers();
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

    setDocumentForm(emptyDocumentForm);
    setSelectedFile(null);
    await fetchTenderDetails();
  };

  const handleAddMaterial = async (e) => {
    e.preventDefault();

    await addTenderMaterial({
      tender_id: id,
      ...materialForm,
    });

    setMaterialForm(emptyMaterialForm);
    await fetchTenderDetails();
  };

  const handleAddBanking = async (e) => {
    e.preventDefault();

    await addTenderBanking({
      tender_id: id,
      ...bankingForm,
    });

    setBankingForm(emptyBankingForm);
    await fetchTenderDetails();
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

    setFinanceForm(emptyFinanceForm);
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
      interest_percent: item.interest_percent
        ? String(item.interest_percent)
        : "",
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

  const handleAssignWorker = async (e) => {
    e.preventDefault();

    if (!workerForm.worker_id) {
      alert("Please select a worker");
      return;
    }

    try {
      await assignWorkerToTender({
        tender_id: Number(id),
        worker_id: Number(workerForm.worker_id),
        notes: workerForm.notes,
        status: workerForm.status,
      });

      setWorkerForm({
        worker_id: "",
        notes: "",
        status: "active",
      });

      await loadTenderWorkers();
    } catch (error) {
      console.error("Assign worker error:", error);
      alert(error.response?.data?.message || "Failed to assign worker.");
    }
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

    setSubcontractorForm(emptySubcontractorForm);
    setEditingAssignedSub(null);
    await fetchTenderDetails();
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

    if (deleteTarget.type === "worker") {
      await removeTenderWorker(deleteTarget.item.id);
      await loadTenderWorkers();
    }

    if (deleteTarget.type === "finance") {
      await deleteFinanceRecord(deleteTarget.item.id);
      await loadFinanceData();
    }

    setDeleteTarget(null);
    await fetchTenderDetails();
  };

  const tenderSummary = calculateTenderDetailsSummary({
    tender,
    materials,
    banking,
    subcontractors,
  });

  const {
    materialTotal,
    subcontractorAssignedTotal,
    bankingTotal,
    gstTotal,
    loanedTotal,
    returnedTotal,
    subcontractorCost,
    materialCost,
    bankingCost,
    tenderIncome,
    totalTenderCost,
    tenderValue,
    remainingBudget,
    tenderProfit,
    tenderProfitPercentage,
  } = tenderSummary;

  const { calculatedGstTotal, calculatedCompanyChargeTotal } =
    calculateFinancePreview(financeForm);

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

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {tender.site_id && (
              <button
                type="button"
                onClick={() => navigate(`/sites/${tender.site_id}`)}
              >
                Back to Tender's Site
              </button>
            )}

            <button type="button" onClick={() => navigate("/sites")}>
              Back to Sites
            </button>
          </div>
        </div>

        <div className="tender-tabs">
          {tenderDetailsTabs.map((tab) => (
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
          <TenderOverviewTab
            tenderValue={tenderValue}
            remainingBudget={remainingBudget}
            documents={documents}
            materialTotal={materialTotal}
            bankingTotal={bankingTotal}
            dailyUpdates={dailyUpdates}
            tenderIncome={tenderIncome}
            totalTenderCost={totalTenderCost}
            tenderProfit={tenderProfit}
            tenderProfitPercentage={tenderProfitPercentage}
            financeSummary={financeSummary}
            materialCost={materialCost}
            subcontractorCost={subcontractorCost}
            bankingCost={bankingCost}
          />
        )}

        {activeTab === "documents" && (
          <TenderDocumentsTab
            documents={documents}
            documentForm={documentForm}
            setDocumentForm={setDocumentForm}
            setSelectedFile={setSelectedFile}
            handleAddDocument={handleAddDocument}
            setDeleteTarget={setDeleteTarget}
          />
        )}

        {activeTab === "materials" && (
          <TenderMaterialsTab
            materials={materials}
            materialForm={materialForm}
            setMaterialForm={setMaterialForm}
            handleAddMaterial={handleAddMaterial}
            setDeleteTarget={setDeleteTarget}
          />
        )}

        {activeTab === "banking" && (
          <TenderBankingTab
            banking={banking}
            bankingForm={bankingForm}
            setBankingForm={setBankingForm}
            handleAddBanking={handleAddBanking}
            setDeleteTarget={setDeleteTarget}
            bankingTotal={bankingTotal}
            gstTotal={gstTotal}
            loanedTotal={loanedTotal}
            returnedTotal={returnedTotal}
          />
        )}

        {activeTab === "finance" && (
          <TenderFinanceTab
            financeSummary={financeSummary}
            financeRecords={financeRecords}
            financeForm={financeForm}
            setFinanceForm={setFinanceForm}
            editingFinance={editingFinance}
            setEditingFinance={setEditingFinance}
            handleAddFinanceRecord={handleAddFinanceRecord}
            startEditFinanceRecord={startEditFinanceRecord}
            setDeleteTarget={setDeleteTarget}
            calculatedGstTotal={calculatedGstTotal}
            calculatedCompanyChargeTotal={calculatedCompanyChargeTotal}
          />
        )}

        {activeTab === "daily" && (
          <TenderDailyProgressTab dailyUpdates={dailyUpdates} />
        )}

        {activeTab === "workers" && (
          <TenderWorkersTab
            workers={workers}
            assignedWorkers={assignedWorkers}
            workerForm={workerForm}
            setWorkerForm={setWorkerForm}
            handleAssignWorker={handleAssignWorker}
            setDeleteTarget={setDeleteTarget}
          />
        )}

        {activeTab === "subcontractors" && (
          <TenderSubcontractorsTab
            subcontractors={subcontractors}
            subcontractorAssignedTotal={subcontractorAssignedTotal}
            editingAssignedSub={editingAssignedSub}
            subcontractorForm={subcontractorForm}
            setSubcontractorForm={setSubcontractorForm}
            allSubcontractors={allSubcontractors}
            handleAssignSubcontractor={handleAssignSubcontractor}
            startEditAssignedSubcontractor={startEditAssignedSubcontractor}
            setEditingAssignedSub={setEditingAssignedSub}
            setDeleteTarget={setDeleteTarget}
          />
        )}
      </section>

      <DeleteVerificationModal
        open={!!deleteTarget}
        itemName={
          deleteTarget?.item?.document_name ||
          deleteTarget?.item?.material_name ||
          deleteTarget?.item?.payment_type ||
          deleteTarget?.item?.record_type ||
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