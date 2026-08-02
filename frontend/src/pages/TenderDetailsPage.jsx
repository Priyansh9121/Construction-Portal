import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import toast from "react-hot-toast";

import DeleteVerificationModal from "../components/DeleteVerificationModal";

import {
  tenderDetailsTabs,
} from "../config/tenderDetailsTabs";

import TenderOverviewTab from "../components/tenderDetails/TenderOverviewTab";
import TenderSitesTab from "../components/tenderDetails/TenderSitesTab";
import TenderDocumentsTab from "../components/tenderDetails/TenderDocumentsTab";
import TenderMaterialsTab from "../components/tenderDetails/TenderMaterialsTab";
import TenderBankingTab from "../components/tenderDetails/TenderBankingTab";
import TenderFinanceTab from "../components/tenderDetails/TenderFinanceTab";
import TenderDailyProgressTab from "../components/tenderDetails/TenderDailyProgressTab";
import TenderSubcontractorsTab from "../components/tenderDetails/TenderSubcontractorsTab";
import TenderWorkersTab from "../components/tenderDetails/TenderWorkersTab";

import {
  getWorkers,
} from "../services/workerService";

import {
  getTenderById,
} from "../services/tenderService";

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

import {
  uploadFile,
} from "../services/uploadService";

import {
  getSubcontractors,
} from "../services/subcontractorService";

const EMPTY_WORKER_FORM = {
  worker_id: "",
  notes: "",
  status: "active",
};

function TenderDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const numericTenderId =
    Number(id);

  const [
    activeTab,
    setActiveTab,
  ] = useState("overview");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    loadError,
    setLoadError,
  ] = useState("");

  const [
    tender,
    setTender,
  ] = useState(null);

  const [
    tenderSites,
    setTenderSites,
  ] = useState([]);

  const [
    documents,
    setDocuments,
  ] = useState([]);

  const [
    materials,
    setMaterials,
  ] = useState([]);

  const [
    banking,
    setBanking,
  ] = useState([]);

  const [
    dailyUpdates,
    setDailyUpdates,
  ] = useState([]);

  const [
    subcontractors,
    setSubcontractors,
  ] = useState([]);

  const [
    allSubcontractors,
    setAllSubcontractors,
  ] = useState([]);

  const [
    payments,
    setPayments,
  ] = useState([]);

  const [
    workers,
    setWorkers,
  ] = useState([]);

  const [
    assignedWorkers,
    setAssignedWorkers,
  ] = useState([]);

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState(null);

  const [
    editingAssignedSub,
    setEditingAssignedSub,
  ] = useState(null);

  const [
    subcontractorForm,
    setSubcontractorForm,
  ] = useState(
    emptySubcontractorForm
  );

  const [
    documentForm,
    setDocumentForm,
  ] = useState(
    emptyDocumentForm
  );

  const [
    selectedFile,
    setSelectedFile,
  ] = useState(null);

  const [
    materialForm,
    setMaterialForm,
  ] = useState(
    emptyMaterialForm
  );

  const [
    bankingForm,
    setBankingForm,
  ] = useState(
    emptyBankingForm
  );

  const [
    workerForm,
    setWorkerForm,
  ] = useState(
    EMPTY_WORKER_FORM
  );

  const [
    addingDocument,
    setAddingDocument,
  ] = useState(false);

  const [
    addingMaterial,
    setAddingMaterial,
  ] = useState(false);

  const [
    addingBanking,
    setAddingBanking,
  ] = useState(false);

  const [
    assigningWorker,
    setAssigningWorker,
  ] = useState(false);

  const [
    savingSubcontractor,
    setSavingSubcontractor,
  ] = useState(false);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const isBusy =
    addingDocument ||
    addingMaterial ||
    addingBanking ||
    assigningWorker ||
    savingSubcontractor ||
    deleting;

  const normaliseArrayResponse = (
    response,
    key
  ) => {
    if (
      Array.isArray(response)
    ) {
      return response;
    }

    if (
      Array.isArray(
        response?.[key]
      )
    ) {
      return response[key];
    }

    if (
      Array.isArray(
        response?.data?.[key]
      )
    ) {
      return response.data[key];
    }

    if (
      Array.isArray(
        response?.data
      )
    ) {
      return response.data;
    }

    return [];
  };

  const normaliseSites = (
    sites
  ) => {
    if (
      !Array.isArray(sites)
    ) {
      return [];
    }

    return sites.filter(
      (site) =>
        site &&
        !site.is_deleted
    );
  };

  const getStatusClass = (
    status
  ) => {
    const value =
      String(status || "")
        .trim()
        .toLowerCase();

    if (
      [
        "running",
        "active",
        "completed",
        "passed",
      ].includes(value)
    ) {
      return "badge green";
    }

    if (
      [
        "failed",
        "cancelled",
        "inactive",
        "rejected",
      ].includes(value)
    ) {
      return "badge red";
    }

    return "badge yellow";
  };

  /*
   * These two, and loadPageData below, are promise chains rather than
   * async/await so their state updates are visibly inside callbacks. That
   * is what makes them safe to start from the mount effect without
   * forcing an immediate second render.
   */
  const loadTenderWorkers =
    useCallback(() => {
      return getTenderWorkers(id).then(
        (response) => {
          setAssignedWorkers(
            normaliseArrayResponse(
              response,
              "workers"
            )
          );
        },
        (error) => {
          console.error(
            "Failed to load tender workers:",
            error.response?.data ||
              error
          );

          setAssignedWorkers([]);

          toast.error(
            error.response?.data
              ?.message ||
              error.message ||
              "Failed to load assigned workers."
          );
        }
      );
    }, [id]);

  const loadPayments =
    useCallback(() => {
      return getPayments({
        tender_id: id,
      }).then(
        (response) => {
          setPayments(
            normaliseArrayResponse(
              response,
              "payments"
            )
          );
        },
        (error) => {
          console.error(
            "Failed to load tender payments:",
            error.response?.data ||
              error
          );

          setPayments([]);

          toast.error(
            error.response?.data
              ?.message ||
              error.message ||
              "Failed to load tender finance records."
          );
        }
      );
    }, [id]);

  const fetchTenderDetails =
    useCallback(
      ({
        showLoader = true,
      } = {}) => {
        if (
          !id ||
          Number.isNaN(
            numericTenderId
          )
        ) {
          return Promise.resolve().then(
            () => {
              setTender(null);
              setTenderSites([]);

              setLoadError(
                "The selected tender ID is invalid."
              );

              setLoading(false);
            }
          );
        }

        return Promise.all([
            getTenderDetails(id),

            getTenderById(id).catch(
              (error) => {
                console.error(
                  "Failed to load core tender and site details:",
                  error.response?.data ||
                    error
                );

                return null;
              }
            ),

            getSubcontractors().catch(
              (error) => {
                console.error(
                  "Failed to load subcontractor list:",
                  error.response?.data ||
                    error
                );

                return {
                  subcontractors: [],
                };
              }
            ),

            getWorkers().catch(
              (error) => {
                console.error(
                  "Failed to load workers:",
                  error.response?.data ||
                    error
                );

                return [];
              }
            ),
          ]).then(
          ([
            tenderResponse,
            coreTenderResponse,
            subcontractorResponse,
            workerResponse,
          ]) => {
          const responseData =
            tenderResponse?.data ||
            tenderResponse ||
            {};

          const detailsTender =
            responseData.tender ||
            null;

          const coreTender =
            coreTenderResponse?.tender ||
            coreTenderResponse ||
            null;

          const mergedTender =
            detailsTender ||
            coreTender
              ? {
                  ...(detailsTender ||
                    {}),
                  ...(coreTender ||
                    {}),
                  sites:
                    normaliseSites(
                      coreTender?.sites
                    ).length > 0
                      ? normaliseSites(
                          coreTender.sites
                        )
                      : normaliseSites(
                          detailsTender?.sites
                        ),
                }
              : null;

          const mergedSites =
            normaliseSites(
              mergedTender?.sites
            );

          setTender(
            mergedTender
          );

          setTenderSites(
            mergedSites
          );

          setDocuments(
            Array.isArray(
              responseData.documents
            )
              ? responseData.documents
              : []
          );

          setMaterials(
            Array.isArray(
              responseData.materials
            )
              ? responseData.materials
              : []
          );

          setBanking(
            Array.isArray(
              responseData.banking
            )
              ? responseData.banking
              : []
          );

          setDailyUpdates(
            Array.isArray(
              responseData.dailyUpdates
            )
              ? responseData.dailyUpdates
              : Array.isArray(
                    responseData.daily_updates
                  )
                ? responseData.daily_updates
                : []
          );

          setSubcontractors(
            Array.isArray(
              responseData.subcontractors
            )
              ? responseData.subcontractors
              : []
          );

          setAllSubcontractors(
            normaliseArrayResponse(
              subcontractorResponse,
              "subcontractors"
            )
          );

          setWorkers(
            normaliseArrayResponse(
              workerResponse,
              "workers"
            )
          );

          setLoadError(
            mergedTender
              ? ""
              : "Tender details were not found."
          );

          if (showLoader) {
            setLoading(false);
          }
        },
        (error) => {
          console.error(
            "Failed to load tender details:",
            error.response?.data ||
              error
          );

          const message =
            error.response?.data
              ?.message ||
            error.message ||
            "Failed to load tender details.";

          setLoadError(message);
          setTender(null);
          setTenderSites([]);

          if (showLoader) {
            setLoading(false);
          } else {
            toast.error(message);
          }
        }
        );
      },
      [
        id,
        numericTenderId,
      ]
    );

  /*
   * Returns the chain rather than awaiting it, so the state updates the
   * three loaders make are visibly deferred into promise callbacks and
   * this is safe to start from the mount effect. `loading` already starts
   * true, so the first paint shows the spinner without anything having to
   * set it here.
   */
  const loadPageData =
    useCallback(() => {
      return Promise.all([
        fetchTenderDetails(),
        loadPayments(),
        loadTenderWorkers(),
      ]);
    }, [
      fetchTenderDetails,
      loadPayments,
      loadTenderWorkers,
    ]);

  /*
   * The Retry button. Unlike the first load, this one has to put the page
   * back into its loading state before starting.
   */
  const retryPageData =
    useCallback(() => {
      setLoading(true);
      setLoadError("");

      return loadPageData();
    }, [loadPageData]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const refreshTenderDetails =
    async () => {
      await fetchTenderDetails({
        showLoader: false,
      });
    };

  const handleAddDocument =
    async (event) => {
      event.preventDefault();

      if (addingDocument) {
        return;
      }

      const documentName =
        String(
          documentForm.document_name ||
            ""
        ).trim();

      if (!documentName) {
        toast.error(
          "Document name is required."
        );

        return;
      }

      try {
        setAddingDocument(true);

        let uploadedUrl =
          String(
            documentForm.file_url ||
              ""
          ).trim();

        if (selectedFile) {
          uploadedUrl =
            await uploadFile(
              selectedFile,
              "tender-documents"
            );
        }

        await addTenderDocument({
          tender_id:
            numericTenderId,

          document_name:
            documentName,

          document_type:
            documentForm.document_type ||
            null,

          file_url:
            uploadedUrl ||
            null,
        });

        setDocumentForm(
          emptyDocumentForm
        );

        setSelectedFile(null);

        await refreshTenderDetails();

        toast.success(
          "Tender document added successfully."
        );
      } catch (error) {
        console.error(
          "Failed to add tender document:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            error.message ||
            "Failed to add tender document."
        );
      } finally {
        setAddingDocument(false);
      }
    };

  const handleAddMaterial =
    async (event) => {
      event.preventDefault();

      if (addingMaterial) {
        return;
      }

      const materialName =
        String(
          materialForm.material_name ||
            ""
        ).trim();

      if (!materialName) {
        toast.error(
          "Material name is required."
        );

        return;
      }

      try {
        setAddingMaterial(true);

        await addTenderMaterial({
          tender_id:
            numericTenderId,

          ...materialForm,

          material_name:
            materialName,

          quantity:
            Number(
              materialForm.quantity ||
                0
            ),

          amount:
            Number(
              materialForm.amount ||
                materialForm.cost ||
                0
            ),
        });

        setMaterialForm(
          emptyMaterialForm
        );

        await refreshTenderDetails();

        toast.success(
          "Tender material added successfully."
        );
      } catch (error) {
        console.error(
          "Failed to add tender material:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            error.message ||
            "Failed to add tender material."
        );
      } finally {
        setAddingMaterial(false);
      }
    };

  const handleAddBanking =
    async (event) => {
      event.preventDefault();

      if (addingBanking) {
        return;
      }

      try {
        setAddingBanking(true);

        await addTenderBanking({
          tender_id:
            numericTenderId,

          ...bankingForm,
        });

        setBankingForm(
          emptyBankingForm
        );

        await refreshTenderDetails();

        toast.success(
          "Banking record added successfully."
        );
      } catch (error) {
        console.error(
          "Failed to add banking record:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            error.message ||
            "Failed to add banking record."
        );
      } finally {
        setAddingBanking(false);
      }
    };

  const handleAssignWorker =
    async (event) => {
      event.preventDefault();

      if (assigningWorker) {
        return;
      }

      if (
        !workerForm.worker_id
      ) {
        toast.error(
          "Please select a worker."
        );

        return;
      }

      try {
        setAssigningWorker(true);

        await assignWorkerToTender({
          tender_id:
            numericTenderId,

          worker_id:
            Number(
              workerForm.worker_id
            ),

          notes:
            String(
              workerForm.notes ||
                ""
            ).trim(),

          status:
            workerForm.status,
        });

        setWorkerForm({
          ...EMPTY_WORKER_FORM,
        });

        await loadTenderWorkers();

        toast.success(
          "Worker assigned successfully."
        );
      } catch (error) {
        console.error(
          "Failed to assign worker:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            error.message ||
            "Failed to assign worker."
        );
      } finally {
        setAssigningWorker(false);
      }
    };

  const handleAssignSubcontractor =
    async (event) => {
      event.preventDefault();

      if (
        savingSubcontractor
      ) {
        return;
      }

      const workDescription =
        String(
          subcontractorForm.work_description ||
            ""
        ).trim();

      const assignedAmount =
        Number(
          subcontractorForm.assigned_amount ||
            0
        );

      if (
        !editingAssignedSub &&
        !subcontractorForm.subcontractor_id
      ) {
        toast.error(
          "Please select a subcontractor."
        );

        return;
      }

      if (!workDescription) {
        toast.error(
          "Please enter a work description."
        );

        return;
      }

      if (
        assignedAmount <= 0 ||
        Number.isNaN(
          assignedAmount
        )
      ) {
        toast.error(
          "Assigned amount must be greater than zero."
        );

        return;
      }

      try {
        setSavingSubcontractor(
          true
        );

        if (
          editingAssignedSub
        ) {
          await updateTenderSubcontractor(
            numericTenderId,
            editingAssignedSub.id,
            {
              work_description:
                workDescription,

              assigned_amount:
                assignedAmount,

              status:
                subcontractorForm.status,
            }
          );

          toast.success(
            "Subcontractor assignment updated successfully."
          );
        } else {
          await assignTenderSubcontractor({
            tender_id:
              numericTenderId,

            subcontractor_id:
              Number(
                subcontractorForm.subcontractor_id
              ),

            work_description:
              workDescription,

            assigned_amount:
              assignedAmount,

            status:
              subcontractorForm.status,
          });

          toast.success(
            "Subcontractor assigned successfully."
          );
        }

        setSubcontractorForm(
          emptySubcontractorForm
        );

        setEditingAssignedSub(
          null
        );

        await refreshTenderDetails();
      } catch (error) {
        console.error(
          "Failed to save subcontractor assignment:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            error.message ||
            "Failed to save subcontractor assignment."
        );
      } finally {
        setSavingSubcontractor(
          false
        );
      }
    };

  const startEditAssignedSubcontractor =
    (subcontractor) => {
      if (isBusy) {
        return;
      }

      setEditingAssignedSub(
        subcontractor
      );

      setSubcontractorForm({
        subcontractor_id:
          subcontractor.subcontractor_id ||
          "",

        work_description:
          subcontractor.work_description ||
          "",

        assigned_amount:
          subcontractor.assigned_amount ||
          "",

        status:
          subcontractor.status ||
          "active",
      });

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    };

  const cancelAssignedSubcontractorEdit =
    () => {
      if (
        savingSubcontractor
      ) {
        return;
      }

      setEditingAssignedSub(
        null
      );

      setSubcontractorForm(
        emptySubcontractorForm
      );
    };

  const handleConfirmDelete =
    async () => {
      if (
        !deleteTarget ||
        deleting
      ) {
        return;
      }

      const {
        type,
        item,
      } = deleteTarget;

      if (!item?.id) {
        toast.error(
          "The selected record cannot be deleted."
        );

        return;
      }

      try {
        setDeleting(true);

        switch (type) {
          case "document":
            await deleteTenderDocument(
              numericTenderId,
              item.id
            );

            toast.success(
              "Document deleted successfully."
            );

            break;

          case "material":
            await deleteTenderMaterial(
              numericTenderId,
              item.id
            );

            toast.success(
              "Material deleted successfully."
            );

            break;

          case "banking":
            await deleteTenderBanking(
              numericTenderId,
              item.id
            );

            toast.success(
              "Banking record deleted successfully."
            );

            break;

          case "subcontractor":
            await removeTenderSubcontractor(
              numericTenderId,
              item.id
            );

            if (
              editingAssignedSub?.id ===
              item.id
            ) {
              cancelAssignedSubcontractorEdit();
            }

            toast.success(
              "Subcontractor assignment removed successfully."
            );

            break;

          case "worker":
            await removeTenderWorker(
              numericTenderId,
              item.id
            );

            await loadTenderWorkers();

            toast.success(
              "Worker assignment removed successfully."
            );

            break;

          case "payment":
            await deletePaymentRecord(
              item.id
            );

            await loadPayments();

            toast.success(
              "Finance record deleted successfully."
            );

            break;

          default:
            throw new Error(
              "Unsupported delete action."
            );
        }

        setDeleteTarget(null);

        if (
          ![
            "worker",
            "payment",
          ].includes(type)
        ) {
          await refreshTenderDetails();
        }
      } catch (error) {
        console.error(
          "Failed to delete tender record:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            error.message ||
            "Failed to delete record."
        );
      } finally {
        setDeleting(false);
      }
    };

  const tenderSummary =
    useMemo(
      () =>
        calculateTenderDetailsSummary({
          tender,
          materials,
          banking,
          subcontractors,
        }),
      [
        tender,
        materials,
        banking,
        subcontractors,
      ]
    );

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
    financeSummary,
  } = tenderSummary;

  if (loading) {
    return (
      <section className="panel">
        <h2>
          Loading project details...
        </h2>

        <p className="muted-text">
          Loading sites,
          documents, materials,
          finance, workers and
          subcontractors.
        </p>
      </section>
    );
  }

  if (
    loadError ||
    !tender
  ) {
    return (
      <section className="panel">
        <h2>
          Project could not be loaded
        </h2>

        <p
          className="error"
          role="alert"
        >
          {loadError ||
            "Project not found."}
        </p>

        <div className="form-actions">
          <button
            type="button"
            onClick={
              retryPageData
            }
          >
            Retry
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={() =>
              navigate("/tenders")
            }
          >
            Back to Projects
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="tender-details-page">
        <section className="panel tender-header">
          <div>
            <p className="dashboard-hero-eyebrow">
              Project Details
            </p>

            <h2>
              {tender.title ||
                tender.tender_name ||
                "Unnamed Project"}
            </h2>

            <p>
              Status:{" "}
              <span
                className={
                  getStatusClass(
                    tender.status
                  )
                }
              >
                {tender.status ||
                  "unknown"}
              </span>
            </p>

            <p>
              Client:{" "}
              {tender.client_name ||
                "N/A"}
            </p>

            <p>
              Project Type:{" "}
              {tender.tender_type ||
                "N/A"}
            </p>

            <p>
              Start Date:{" "}
              {tender.start_date
                ? String(
                    tender.start_date
                  ).slice(0, 10)
                : "N/A"}
            </p>

            <p>
              Due Date:{" "}
              {tender.due_date
                ? String(
                    tender.due_date
                  ).slice(0, 10)
                : "N/A"}
            </p>

            <p>
              Project Sites:{" "}
              <strong>
                {tenderSites.length}
              </strong>
            </p>

            {tenderSites.length >
              0 && (
              <p className="muted-text">
                {tenderSites
                  .map(
                    (site) =>
                      site.site_name
                  )
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>

          <div className="report-actions">
            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  "sites"
                )
              }
              disabled={isBusy}
            >
              View Project Sites
            </button>

            <button
              type="button"
              className="secondary-btn"
              onClick={() =>
                navigate("/tenders")
              }
              disabled={isBusy}
            >
              Back to Projects
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="tender-tabs">
            {tenderDetailsTabs.map(
              (tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={
                    activeTab ===
                    tab.key
                      ? "active-tab"
                      : ""
                  }
                  onClick={() =>
                    setActiveTab(
                      tab.key
                    )
                  }
                  disabled={isBusy}
                >
                  {tab.label}
                </button>
              )
            )}
          </div>
        </section>

        {activeTab ===
          "overview" && (
          <TenderOverviewTab
            tenderValue={
              tenderValue
            }
            remainingBudget={
              remainingBudget
            }
            documents={
              documents
            }
            materialTotal={
              materialTotal
            }
            bankingTotal={
              bankingTotal
            }
            dailyUpdates={
              dailyUpdates
            }
            tenderIncome={
              tenderIncome
            }
            totalTenderCost={
              totalTenderCost
            }
            payments={
              payments
            }
            tenderProfit={
              tenderProfit
            }
            tenderProfitPercentage={
              tenderProfitPercentage
            }
            financeSummary={
              financeSummary
            }
            materialCost={
              materialCost
            }
            subcontractorCost={
              subcontractorCost
            }
            bankingCost={
              bankingCost
            }
          />
        )}

        {activeTab ===
          "sites" && (
          <TenderSitesTab
            sites={
              tenderSites
            }
            tender={
              tender
            }
          />
        )}

        {activeTab ===
          "documents" && (
          <TenderDocumentsTab
            documents={
              documents
            }
            documentForm={
              documentForm
            }
            setDocumentForm={
              setDocumentForm
            }
            setSelectedFile={
              setSelectedFile
            }
            handleAddDocument={
              handleAddDocument
            }
            setDeleteTarget={
              setDeleteTarget
            }
            submitting={
              addingDocument
            }
          />
        )}

        {activeTab ===
          "materials" && (
          <TenderMaterialsTab
            materials={
              materials
            }
            materialForm={
              materialForm
            }
            setMaterialForm={
              setMaterialForm
            }
            handleAddMaterial={
              handleAddMaterial
            }
            setDeleteTarget={
              setDeleteTarget
            }
            submitting={
              addingMaterial
            }
          />
        )}

        {activeTab ===
          "banking" && (
          <TenderBankingTab
            banking={
              banking
            }
            bankingForm={
              bankingForm
            }
            setBankingForm={
              setBankingForm
            }
            handleAddBanking={
              handleAddBanking
            }
            setDeleteTarget={
              setDeleteTarget
            }
            bankingTotal={
              bankingTotal
            }
            gstTotal={
              gstTotal
            }
            loanedTotal={
              loanedTotal
            }
            returnedTotal={
              returnedTotal
            }
            submitting={
              addingBanking
            }
          />
        )}

        {activeTab ===
          "finance" && (
          <TenderFinanceTab
            payments={
              payments
            }
            tenderId={
              id
            }
            setDeleteTarget={
              setDeleteTarget
            }
            tender={
              tender
            }
            subcontractors={
              subcontractors
            }
          />
        )}

        {activeTab ===
          "daily" && (
          <TenderDailyProgressTab
            dailyUpdates={
              dailyUpdates
            }
            sites={
              tenderSites
            }
            tender={
              tender
            }
          />
        )}

        {activeTab ===
          "workers" && (
          <TenderWorkersTab
            workers={
              workers
            }
            assignedWorkers={
              assignedWorkers
            }
            workerForm={
              workerForm
            }
            setWorkerForm={
              setWorkerForm
            }
            handleAssignWorker={
              handleAssignWorker
            }
            setDeleteTarget={
              setDeleteTarget
            }
            submitting={
              assigningWorker
            }
            sites={
              tenderSites
            }
          />
        )}

        {activeTab ===
          "subcontractors" && (
          <TenderSubcontractorsTab
            subcontractors={
              subcontractors
            }
            subcontractorAssignedTotal={
              subcontractorAssignedTotal
            }
            editingAssignedSub={
              editingAssignedSub
            }
            subcontractorForm={
              subcontractorForm
            }
            setSubcontractorForm={
              setSubcontractorForm
            }
            allSubcontractors={
              allSubcontractors
            }
            handleAssignSubcontractor={
              handleAssignSubcontractor
            }
            startEditAssignedSubcontractor={
              startEditAssignedSubcontractor
            }
            setEditingAssignedSub={
              setEditingAssignedSub
            }
            setDeleteTarget={
              setDeleteTarget
            }
            submitting={
              savingSubcontractor
            }
            sites={
              tenderSites
            }
          />
        )}
      </section>

      <DeleteVerificationModal
        open={
          Boolean(
            deleteTarget
          )
        }
        itemName={
          deleteTarget?.item
            ?.document_name ||
          deleteTarget?.item
            ?.material_name ||
          deleteTarget?.item
            ?.payment_type ||
          deleteTarget?.item
            ?.record_type ||
          deleteTarget?.item
            ?.full_name ||
          deleteTarget?.item
            ?.worker_name ||
          deleteTarget?.item
            ?.subcontractor_name ||
          "record"
        }
        onCancel={() => {
          if (!deleting) {
            setDeleteTarget(
              null
            );
          }
        }}
        onConfirm={
          handleConfirmDelete
        }
        loading={
          deleting
        }
      />
    </>
  );
}

export default TenderDetailsPage; 