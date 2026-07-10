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
import ExportButtons from "../components/export/ExportButtons";

import {
  getPayments,
  deletePayment as deletePaymentRecord,
} from "../services/paymentService";

import {
  getTenderWorkers,
  assignWorkerToTender,
  removeTenderWorker,
} from "../services/tenderWorkerService";

import {
  calculateTenderDetailsSummary,
} from "../utils/tenderCalculations";

import {
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
  assignTenderSubcontractor,
  removeTenderSubcontractor,
  updateTenderSubcontractor,
} from "../services/tenderDetailsService";

import { uploadFile } from "../services/uploadService";

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

  const [payments, setPayments] = useState([]);

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

  const loadPayments = async () => {
    try {
      const data = await getPayments({ tender_id: id });
      setPayments(data || []);
    } catch (error) {
      console.error("Load payments error:", error);
    }
  };

  useEffect(() => {
    fetchTenderDetails();
    loadPayments();
    loadTenderWorkers();
  }, [id]);

  const handleAddDocument = async (e) => {
    e.preventDefault();

    let uploadedUrl = documentForm.file_url;

    if (selectedFile) {
      uploadedUrl = await uploadFile(selectedFile, "tender-documents");
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

    if (deleteTarget.type === "payment") {
      await deletePaymentRecord(deleteTarget.item.id);
      await loadPayments();
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
            payments={payments}
            tenderProfit={tenderProfit}
            tenderProfitPercentage={tenderProfitPercentage}
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
            payments={payments}
            tenderId={id}
            setDeleteTarget={setDeleteTarget}
            tender={tender}
            subcontractors={subcontractors}
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