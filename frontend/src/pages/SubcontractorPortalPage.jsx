import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { useAuth } from "../contexts/AuthContext";
import { formatCurrency } from "../utils/currency";

import ExportButtons from "../components/export/ExportButtons";

import {
  getSubcontractorProfile,
  getSubcontractorTenders,
  getSubcontractorTenderDetails,
  createSubcontractorDailyUpdate,
  addSubcontractorTenderDocument,
} from "../services/subcontractorPortalService";

import { uploadFile } from "../services/uploadService";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const EMPTY_DOCUMENT_FORM = {
  document_name: "",
  document_type: "PDF",
};

function SubcontractorPortalPage({
  logout,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const today = useMemo(
    () =>
      new Date()
        .toISOString()
        .slice(0, 10),
    []
  );

  const minimumUpdateDate = useMemo(() => {
    const date = new Date();

    date.setDate(
      date.getDate() - 2
    );

    return date
      .toISOString()
      .slice(0, 10);
  }, []);

  const [
    subcontractor,
    setSubcontractor,
  ] = useState(null);

  const [tenders, setTenders] =
    useState([]);

  const [
    selectedTenderId,
    setSelectedTenderId,
  ] = useState("");

  const [
    selectedTender,
    setSelectedTender,
  ] = useState(null);

  const [
    documents,
    setDocuments,
  ] = useState([]);

  const [updates, setUpdates] =
    useState([]);

  const [
    activeSection,
    setActiveSection,
  ] = useState("overview");

  const [
    updateForm,
    setUpdateForm,
  ] = useState({
    log_date: today,
    notes: "",
  });

  const [
    updatePhoto,
    setUpdatePhoto,
  ] = useState(null);

  const [
    updatePhotoPreview,
    setUpdatePhotoPreview,
  ] = useState("");

  const [
    documentForm,
    setDocumentForm,
  ] = useState(
    EMPTY_DOCUMENT_FORM
  );

  const [
    documentFile,
    setDocumentFile,
  ] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [
    loadError,
    setLoadError,
  ] = useState("");

  const [
    tenderLoading,
    setTenderLoading,
  ] = useState(false);

  const [
    updateSubmitting,
    setUpdateSubmitting,
  ] = useState(false);

  const [
    documentSubmitting,
    setDocumentSubmitting,
  ] = useState(false);

  const [
    loggingOut,
    setLoggingOut,
  ] = useState(false);

  const dateOnly = (value) =>
    value
      ? String(value).slice(0, 10)
      : "-";

  const normaliseStatus = (
    value
  ) =>
    String(value || "pending")
      .trim()
      .toLowerCase();

  const getStatusClass = (
    status
  ) => {
    const value =
      normaliseStatus(status);

    if (
      [
        "approved",
        "active",
        "running",
        "paid",
        "completed",
      ].includes(value)
    ) {
      return "badge green";
    }

    if (
      [
        "rejected",
        "inactive",
        "cancelled",
        "overdue",
      ].includes(value)
    ) {
      return "badge red";
    }

    return "badge yellow";
  };

  const extractArray = (
    response,
    key
  ) => {
    if (Array.isArray(response)) {
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

  const clearTenderData = () => {
    setSelectedTender(null);
    setDocuments([]);
    setUpdates([]);
  };

  const clearUpdatePhoto = () => {
    if (updatePhotoPreview) {
      URL.revokeObjectURL(
        updatePhotoPreview
      );
    }

    setUpdatePhoto(null);
    setUpdatePhotoPreview("");
  };

  const totals = useMemo(() => {
    const runningTenders =
      tenders.filter(
        (item) =>
          normaliseStatus(
            item.assignment_status ||
              item.tender_status
          ) === "running"
      );

    const completedTenders =
      tenders.filter((item) =>
        [
          "completed",
          "passed",
        ].includes(
          normaliseStatus(
            item.assignment_status ||
              item.tender_status
          )
        )
      );

    const pendingUpdates =
      updates.filter(
        (item) =>
          normaliseStatus(
            item.approval_status ||
              item.status
          ) === "pending"
      );

    const approvedUpdates =
      updates.filter(
        (item) =>
          normaliseStatus(
            item.approval_status ||
              item.status
          ) === "approved"
      );

    return {
      assignedValue:
        tenders.reduce(
          (sum, item) =>
            sum +
            Number(
              item.assigned_amount ||
                0
            ),
          0
        ),

      runningTenders:
        runningTenders.length,

      completedTenders:
        completedTenders.length,

      pendingUpdates:
        pendingUpdates.length,

      approvedUpdates:
        approvedUpdates.length,
    };
  }, [
    tenders,
    updates,
  ]);

  const recentUpdates = useMemo(() => {
    return [...updates]
      .sort(
        (first, second) =>
          new Date(
            second.log_date ||
              second.created_at ||
              0
          ) -
          new Date(
            first.log_date ||
              first.created_at ||
              0
          )
      )
      .slice(0, 5);
  }, [updates]);

  const openTender = useCallback(
    async (
      tenderId,
      {
        showToast = true,
      } = {}
    ) => {
      if (!tenderId) {
        setSelectedTenderId("");
        clearTenderData();
        return;
      }

      const assigned =
        tenders.some(
          (item) =>
            String(
              item.tender_id
            ) ===
            String(tenderId)
        );

      if (
        tenders.length > 0 &&
        !assigned
      ) {
        toast.error(
          "This tender is not assigned to your account."
        );

        return;
      }

      try {
        setTenderLoading(true);

        const response =
          await getSubcontractorTenderDetails(
            tenderId
          );

        const data =
          response?.data ||
          response ||
          {};

        const tenderRecord =
          data.tender || null;

        const documentRecords =
          extractArray(
            data,
            "documents"
          );

        const updateRecords =
          extractArray(
            data,
            "updates"
          );

        setSelectedTender(
          tenderRecord
        );

        setSelectedTenderId(
          String(tenderId)
        );

        setDocuments(
          documentRecords
        );

        setUpdates(
          updateRecords
        );

        if (
          !tenderRecord &&
          showToast
        ) {
          toast.error(
            "Tender details were not found."
          );
        }
      } catch (error) {
        console.error(
          "Failed to load tender details:",
          error.response?.data ||
            error
        );

        clearTenderData();

        if (showToast) {
          toast.error(
            error.response?.data
              ?.message ||
              "Failed to load tender details."
          );
        }
      } finally {
        setTenderLoading(false);
      }
    },
    [tenders]
  );

  const loadPortal =
    useCallback(async () => {
      try {
        setLoading(true);
        setLoadError("");

        const [
          profileResponse,
          tenderResponse,
        ] = await Promise.all([
          getSubcontractorProfile(),
          getSubcontractorTenders(),
        ]);

        const profile =
          profileResponse
            ?.subcontractor ||
          profileResponse?.data
            ?.subcontractor ||
          null;

        const scopedTenders =
          extractArray(
            tenderResponse,
            "tenders"
          );

        setSubcontractor(
          profile
        );

        setTenders(
          scopedTenders
        );

        if (
          scopedTenders.length >
          0
        ) {
          const firstTenderId =
            scopedTenders[0]
              .tender_id;

          setSelectedTenderId(
            String(firstTenderId)
          );

          try {
            setTenderLoading(true);

            const response =
              await getSubcontractorTenderDetails(
                firstTenderId
              );

            const data =
              response?.data ||
              response ||
              {};

            setSelectedTender(
              data.tender || null
            );

            setDocuments(
              extractArray(
                data,
                "documents"
              )
            );

            setUpdates(
              extractArray(
                data,
                "updates"
              )
            );
          } finally {
            setTenderLoading(false);
          }
        } else {
          setSelectedTenderId(
            ""
          );

          clearTenderData();
        }
      } catch (error) {
        console.error(
          "Failed to load subcontractor portal:",
          error.response?.data ||
            error
        );

        setLoadError(
          error.response?.data
            ?.message ||
            "Failed to load your subcontractor portal."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    loadPortal();
  }, [loadPortal]);

  useEffect(() => {
    return () => {
      if (
        updatePhotoPreview
      ) {
        URL.revokeObjectURL(
          updatePhotoPreview
        );
      }
    };
  }, [updatePhotoPreview]);

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    try {
      setLoggingOut(true);

      if (
        typeof logout ===
        "function"
      ) {
        await logout();
      }
    } catch (error) {
      console.error(
        "Subcontractor logout failed:",
        error
      );
    } finally {
      navigate("/login", {
        replace: true,
      });

      setLoggingOut(false);
    }
  };

  const handleTenderChange =
    async (event) => {
      const tenderId =
        event.target.value;

      setSelectedTenderId(
        tenderId
      );

      if (!tenderId) {
        clearTenderData();
        return;
      }

      await openTender(
        tenderId
      );
    };

  const handleUpdatePhoto = (
    event
  ) => {
    const file =
      event.target.files?.[0] ||
      null;

    if (
      file &&
      !file.type.startsWith(
        "image/"
      )
    ) {
      event.target.value = "";

      toast.error(
        "Progress evidence must be an image."
      );

      return;
    }

    if (
      file &&
      file.size >
        MAX_FILE_SIZE
    ) {
      event.target.value = "";

      toast.error(
        "The image must be smaller than 10 MB."
      );

      return;
    }

    clearUpdatePhoto();

    setUpdatePhoto(file);

    setUpdatePhotoPreview(
      file
        ? URL.createObjectURL(
            file
          )
        : ""
    );
  };

  const handleUpdateSubmit =
    async (event) => {
      event.preventDefault();

      if (updateSubmitting) {
        return;
      }

      if (!selectedTender) {
        toast.error(
          "Select one of your assigned tenders."
        );

        return;
      }

      if (
        updateForm.log_date <
          minimumUpdateDate ||
        updateForm.log_date >
          today
      ) {
        toast.error(
          "Updates can only be submitted for today or the previous two days."
        );

        return;
      }

      const cleanNotes =
        updateForm.notes.trim();

      if (
        !cleanNotes &&
        !updatePhoto
      ) {
        toast.error(
          "Add progress notes or a site photo."
        );

        return;
      }

      try {
        setUpdateSubmitting(
          true
        );

        let photoUrl = null;

        if (updatePhoto) {
          photoUrl =
            await uploadFile(
              updatePhoto,
              "subcontractor-updates"
            );
        }

        const result =
          await createSubcontractorDailyUpdate({
            site_id:
              selectedTender.site_id,

            tender_id:
              selectedTender.id,

            log_date:
              updateForm.log_date,

            notes:
              cleanNotes,

            photo_url:
              photoUrl,
          });

        setUpdateForm({
          log_date: today,
          notes: "",
        });

        clearUpdatePhoto();

        await openTender(
          selectedTender.id,
          {
            showToast: false,
          }
        );

        setActiveSection(
          "updates"
        );

        toast.success(
          result?.message ||
            "Daily update submitted for approval."
        );
      } catch (error) {
        console.error(
          "Failed to submit subcontractor update:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            "Failed to submit your daily update."
        );
      } finally {
        setUpdateSubmitting(
          false
        );
      }
    };

  const handleDocumentFile =
    (event) => {
      const file =
        event.target.files?.[0] ||
        null;

      if (!file) {
        setDocumentFile(null);
        return;
      }

      if (
        file.size >
        MAX_FILE_SIZE
      ) {
        event.target.value = "";

        setDocumentFile(null);

        toast.error(
          "The document must be smaller than 10 MB."
        );

        return;
      }

      if (
        file.type &&
        !ALLOWED_DOCUMENT_TYPES.includes(
          file.type
        )
      ) {
        event.target.value = "";

        setDocumentFile(null);

        toast.error(
          "Only PDF, Word, JPG and PNG files are supported."
        );

        return;
      }

      setDocumentFile(file);
    };

  const handleDocumentSubmit =
    async (event) => {
      event.preventDefault();

      if (
        documentSubmitting
      ) {
        return;
      }

      if (!selectedTender) {
        toast.error(
          "Select an assigned tender."
        );

        return;
      }

      const documentName =
        documentForm.document_name.trim();

      if (!documentName) {
        toast.error(
          "Document name is required."
        );

        return;
      }

      if (!documentFile) {
        toast.error(
          "Select a document."
        );

        return;
      }

      try {
        setDocumentSubmitting(
          true
        );

        const fileUrl =
          await uploadFile(
            documentFile,
            "subcontractor-documents"
          );

        await addSubcontractorTenderDocument({
          tender_id:
            selectedTender.id,

          document_name:
            documentName,

          document_type:
            documentForm.document_type,

          file_url:
            fileUrl,
        });

        setDocumentForm(
          EMPTY_DOCUMENT_FORM
        );

        setDocumentFile(null);

        event.currentTarget.reset();

        await openTender(
          selectedTender.id,
          {
            showToast: false,
          }
        );

        toast.success(
          `${documentName} uploaded successfully.`
        );
      } catch (error) {
        console.error(
          "Failed to upload subcontractor document:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            "Failed to upload the document."
        );
      } finally {
        setDocumentSubmitting(
          false
        );
      }
    };

  const handleOpenTenderFromTable =
    async (tenderId) => {
      await openTender(
        tenderId
      );

      setActiveSection(
        "overview"
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    };

  const tenderExportColumns = [
    {
      key: "tender",
      label: "Tender",
    },
    {
      key: "site",
      label: "Site",
    },
    {
      key: "status",
      label: "Status",
    },
    {
      key: "assigned_amount",
      label: "Assigned Amount",
    },
  ];

  const tenderExportRows =
    tenders.map((item) => ({
      tender:
        item.tender_title || "",

      site:
        item.site_name || "",

      status:
        item.assignment_status ||
        item.tender_status ||
        "active",

      assigned_amount:
        formatCurrency(
          item.assigned_amount
        ),
    }));

  const updateExportColumns = [
    {
      key: "date",
      label: "Date",
    },
    {
      key: "tender",
      label: "Tender",
    },
    {
      key: "site",
      label: "Site",
    },
    {
      key: "notes",
      label: "Notes",
    },
    {
      key: "status",
      label: "Status",
    },
    {
      key: "admin_comment",
      label: "Admin Comment",
    },
    {
      key: "photo",
      label: "Photo URL",
    },
  ];

  const updateExportRows =
    updates.map((item) => ({
      date:
        dateOnly(
          item.log_date
        ),

      tender:
        item.tender_title ||
        selectedTender?.title ||
        "",

      site:
        item.site_name ||
        selectedTender?.site_name ||
        "",

      notes:
        item.notes || "",

      status:
        normaliseStatus(
          item.approval_status ||
            item.status
        ),

      admin_comment:
        item.admin_comment ||
        "",

      photo:
        item.photo_url || "",
    }));

  const profileExportRows = [
    {
      field: "Name",
      value:
        subcontractor?.full_name ||
        user?.full_name ||
        "",
    },
    {
      field: "Business",
      value:
        subcontractor?.business_name ||
        "",
    },
    {
      field: "Email",
      value:
        subcontractor?.email ||
        subcontractor?.login_email ||
        user?.email ||
        "",
    },
    {
      field: "Phone",
      value:
        subcontractor?.phone ||
        "",
    },
    {
      field: "GST Number",
      value:
        subcontractor?.gst_number ||
        "",
    },
    {
      field: "Status",
      value:
        subcontractor?.subcontractor_status ||
        subcontractor?.status ||
        "",
    },
  ];

  const exportConfig = {
    overview: {
      filename:
        "my-assigned-tenders",

      title:
        "My Assigned Tenders",

      rows:
        tenderExportRows,

      columns:
        tenderExportColumns,

      summary: {
        Subcontractor:
          subcontractor?.business_name ||
          subcontractor?.full_name ||
          user?.full_name ||
          "Subcontractor",

        Tenders:
          tenders.length,

        "Running Tenders":
          totals.runningTenders,

        "Completed Tenders":
          totals.completedTenders,

        "Assigned Value":
          formatCurrency(
            totals.assignedValue
          ),

        "Pending Updates":
          totals.pendingUpdates,

        "Generated Date":
          today,
      },
    },

    tenders: {
      filename:
        "my-assigned-tenders",

      title:
        "My Assigned Tenders",

      rows:
        tenderExportRows,

      columns:
        tenderExportColumns,

      summary: {
        Tenders:
          tenders.length,

        "Assigned Value":
          formatCurrency(
            totals.assignedValue
          ),
      },
    },

    updates: {
      filename:
        "my-subcontractor-updates",

      title:
        "My Daily Updates",

      rows:
        updateExportRows,

      columns:
        updateExportColumns,

      summary: {
        Updates:
          updates.length,

        Pending:
          totals.pendingUpdates,

        Approved:
          totals.approvedUpdates,

        Tender:
          selectedTender?.title ||
          "No tender selected",
      },
    },

    documents: {
      filename:
        "my-subcontractor-documents",

      title:
        "My Tender Documents",

      rows:
        documents.map(
          (document) => ({
            name:
              document.document_name ||
              "",

            type:
              document.document_type ||
              "",

            file_url:
              document.file_url ||
              "",
          })
        ),

      columns: [
        {
          key: "name",
          label: "Document",
        },
        {
          key: "type",
          label: "Type",
        },
        {
          key: "file_url",
          label: "File URL",
        },
      ],

      summary: {
        Tender:
          selectedTender?.title ||
          "No tender selected",

        Documents:
          documents.length,
      },
    },

    profile: {
      filename:
        "my-subcontractor-profile",

      title:
        "My Subcontractor Profile",

      rows:
        profileExportRows,

      columns: [
        {
          key: "field",
          label: "Field",
        },
        {
          key: "value",
          label: "Value",
        },
      ],

      summary: {
        Subcontractor:
          subcontractor?.business_name ||
          subcontractor?.full_name ||
          "Subcontractor",
      },
    },
  };

  const currentExport =
    exportConfig[
      activeSection
    ] ||
    exportConfig.overview;

  const isBusy =
    tenderLoading ||
    updateSubmitting ||
    documentSubmitting ||
    loggingOut;

  if (loading) {
    return (
      <main className="subcontractor-portal-page">
        <section className="panel">
          <h2>
            Loading your subcontractor portal...
          </h2>

          <p className="muted-text">
            Loading your profile, assigned tenders and project records.
          </p>
        </section>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="subcontractor-portal-page">
        <section className="panel">
          <h2>
            Subcontractor portal could not be loaded
          </h2>

          <p
            className="error"
            role="alert"
          >
            {loadError}
          </p>

          <div className="form-actions">
            <button
              type="button"
              onClick={loadPortal}
              disabled={loading}
            >
              Retry
            </button>

            <button
              type="button"
              className="delete-btn"
              onClick={
                handleLogout
              }
              disabled={
                loggingOut
              }
            >
              {loggingOut
                ? "Logging out..."
                : "Logout"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="subcontractor-portal-page">
      <header className="worker-header">
        <div>
          <p className="muted-text">
            Subcontractor Portal
          </p>

          <h1>
            Welcome back,{" "}
            {subcontractor?.business_name ||
              subcontractor?.full_name ||
              user?.full_name ||
              user?.email ||
              "Subcontractor"}
          </h1>

          <p className="muted-text">
            View assigned tenders, submit progress updates and manage project documents.
          </p>
        </div>

        <div className="report-actions">
          <ExportButtons
            filename={
              currentExport.filename
            }
            title={
              currentExport.title
            }
            rows={
              currentExport.rows
            }
            columns={
              currentExport.columns
            }
            summary={
              currentExport.summary
            }
          />

          <button
            type="button"
            className="delete-btn"
            onClick={
              handleLogout
            }
            disabled={
              loggingOut
            }
          >
            {loggingOut
              ? "Logging out..."
              : "Logout"}
          </button>
        </div>
      </header>

      <section className="summary-cards">
        <div className="card">
          <p>My Tenders</p>

          <h2>
            {tenders.length}
          </h2>
        </div>

        <div className="card highlight-success">
          <p>Running Tenders</p>

          <h2>
            {
              totals.runningTenders
            }
          </h2>
        </div>

        <div className="card">
          <p>Completed Tenders</p>

          <h2>
            {
              totals.completedTenders
            }
          </h2>
        </div>

        <div className="card">
          <p>Assigned Value</p>

          <h2>
            {formatCurrency(
              totals.assignedValue
            )}
          </h2>
        </div>

        <div className="card highlight-warning">
          <p>Pending Updates</p>

          <h2>
            {
              totals.pendingUpdates
            }
          </h2>
        </div>

        <div className="card highlight-success">
          <p>Approved Updates</p>

          <h2>
            {
              totals.approvedUpdates
            }
          </h2>
        </div>

        <div className="card">
          <p>
            Selected Tender Documents
          </p>

          <h2>
            {documents.length}
          </h2>
        </div>
      </section>

      <section className="panel">
        <div className="tabs">
          {[
            [
              "overview",
              "Home",
            ],
            [
              "tenders",
              "My Tenders",
            ],
            [
              "updates",
              "Daily Updates",
            ],
            [
              "documents",
              "Documents",
            ],
            [
              "profile",
              "My Profile",
            ],
          ].map(
            ([key, label]) => (
              <button
                key={key}
                type="button"
                className={
                  activeSection ===
                  key
                    ? "active-tab"
                    : ""
                }
                onClick={() =>
                  setActiveSection(
                    key
                  )
                }
                disabled={isBusy}
              >
                {label}
              </button>
            )
          )}
        </div>
      </section>

      <section className="panel">
        <label>
          Selected Tender

          <select
            value={
              selectedTenderId
            }
            onChange={
              handleTenderChange
            }
            disabled={isBusy}
          >
            <option value="">
              Select assigned tender
            </option>

            {tenders.map(
              (item) => (
                <option
                  key={
                    item.assignment_id
                  }
                  value={
                    item.tender_id
                  }
                >
                  {item.tender_title ||
                    "Tender"}{" "}
                  —{" "}
                  {item.site_name ||
                    "Site"}
                </option>
              )
            )}
          </select>
        </label>

        {selectedTender && (
          <div className="form-preview-total">
            {selectedTender.title ||
              selectedTender.tender_name ||
              "Tender"}{" "}
            ·{" "}
            {selectedTender.site_name ||
              "Site"}{" "}
            ·{" "}
            {selectedTender.status ||
              "Unknown status"}
          </div>
        )}
      </section>

      {tenderLoading && (
        <section className="panel">
          <h2>
            Loading tender details...
          </h2>
        </section>
      )}

      {!tenderLoading &&
        activeSection ===
          "overview" && (
          <section className="payment-grid">
            <section className="panel">
              <div className="section-title-row">
                <div>
                  <h2>
                    Submit Today&apos;s Progress
                  </h2>

                  <p className="muted-text">
                    Submit progress notes or a site photo for the selected tender.
                  </p>
                </div>
              </div>

              <form
                className="payment-form"
                onSubmit={
                  handleUpdateSubmit
                }
              >
                <label>
                  Date

                  <input
                    type="date"
                    min={
                      minimumUpdateDate
                    }
                    max={today}
                    value={
                      updateForm.log_date
                    }
                    onChange={(event) =>
                      setUpdateForm(
                        (
                          previousForm
                        ) => ({
                          ...previousForm,

                          log_date:
                            event.target
                              .value,
                        })
                      )
                    }
                    disabled={
                      updateSubmitting
                    }
                    required
                  />
                </label>

                <label>
                  Progress Notes

                  <textarea
                    value={
                      updateForm.notes
                    }
                    onChange={(event) =>
                      setUpdateForm(
                        (
                          previousForm
                        ) => ({
                          ...previousForm,

                          notes:
                            event.target
                              .value,
                        })
                      )
                    }
                    placeholder="What work was completed?"
                    disabled={
                      updateSubmitting
                    }
                  />
                </label>

                <label>
                  Progress Photo

                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={
                      handleUpdatePhoto
                    }
                    disabled={
                      updateSubmitting
                    }
                  />
                </label>

                <small className="muted-text">
                  Photos must be images under 10 MB. Submitted updates require approval.
                </small>

                {updatePhotoPreview && (
                  <>
                    <img
                      src={
                        updatePhotoPreview
                      }
                      alt="Progress preview"
                      className="worker-photo-preview"
                    />

                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={
                        clearUpdatePhoto
                      }
                      disabled={
                        updateSubmitting
                      }
                    >
                      Remove Photo
                    </button>
                  </>
                )}

                <button
                  type="submit"
                  disabled={
                    updateSubmitting ||
                    !selectedTender
                  }
                >
                  {updateSubmitting
                    ? "Submitting Update..."
                    : "Submit Update"}
                </button>
              </form>
            </section>

            <section className="panel">
              <div className="section-title-row">
                <div>
                  <h2>
                    Recent Updates
                  </h2>

                  <p className="muted-text">
                    Latest updates for the selected tender.
                  </p>
                </div>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Notes</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {recentUpdates.map(
                      (item) => (
                        <tr key={item.id}>
                          <td>
                            {dateOnly(
                              item.log_date
                            )}
                          </td>

                          <td>
                            {item.notes ||
                              "-"}
                          </td>

                          <td>
                            <span
                              className={getStatusClass(
                                item.approval_status ||
                                  item.status
                              )}
                            >
                              {normaliseStatus(
                                item.approval_status ||
                                  item.status
                              )}
                            </span>
                          </td>
                        </tr>
                      )
                    )}

                    {recentUpdates.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan="3"
                          className="empty-table-message"
                        >
                          No updates submitted for this tender yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        )}

      {!tenderLoading &&
        activeSection ===
          "tenders" && (
          <section className="payment-grid">
            <section className="panel">
              <h2>
                My Assigned Tenders
              </h2>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Tender</th>
                      <th>Site</th>
                      <th>Status</th>
                      <th>
                        Assigned Amount
                      </th>
                      <th>Open</th>
                    </tr>
                  </thead>

                  <tbody>
                    {tenders.map(
                      (item) => (
                        <tr
                          key={
                            item.assignment_id
                          }
                        >
                          <td>
                            {item.tender_title ||
                              "-"}
                          </td>

                          <td>
                            {item.site_name ||
                              "-"}
                          </td>

                          <td>
                            <span
                              className={getStatusClass(
                                item.assignment_status ||
                                  item.tender_status
                              )}
                            >
                              {normaliseStatus(
                                item.assignment_status ||
                                  item.tender_status ||
                                  "active"
                              )}
                            </span>
                          </td>

                          <td className="amount-cell">
                            {formatCurrency(
                              item.assigned_amount
                            )}
                          </td>

                          <td>
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenTenderFromTable(
                                  item.tender_id
                                )
                              }
                              disabled={
                                isBusy
                              }
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      )
                    )}

                    {tenders.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan="5"
                          className="empty-table-message"
                        >
                          No tenders are assigned to your account.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel">
              <h2>
                Tender Summary
              </h2>

              {selectedTender ? (
                <table>
                  <tbody>
                    <tr>
                      <th>Tender</th>

                      <td>
                        {selectedTender.title ||
                          selectedTender.tender_name ||
                          "-"}
                      </td>
                    </tr>

                    <tr>
                      <th>Site</th>

                      <td>
                        {selectedTender.site_name ||
                          "-"}
                      </td>
                    </tr>

                    <tr>
                      <th>Status</th>

                      <td>
                        <span
                          className={getStatusClass(
                            selectedTender.status
                          )}
                        >
                          {normaliseStatus(
                            selectedTender.status
                          )}
                        </span>
                      </td>
                    </tr>

                    <tr>
                      <th>Due Date</th>

                      <td>
                        {dateOnly(
                          selectedTender.due_date
                        )}
                      </td>
                    </tr>

                    <tr>
                      <th>Documents</th>

                      <td>
                        {documents.length}
                      </td>
                    </tr>

                    <tr>
                      <th>Updates</th>

                      <td>
                        {updates.length}
                      </td>
                    </tr>

                    <tr>
                      <th>
                        Last Update
                      </th>

                      <td>
                        {updates.length >
                        0
                          ? dateOnly(
                              [...updates].sort(
                                (
                                  first,
                                  second
                                ) =>
                                  new Date(
                                    second.log_date ||
                                      0
                                  ) -
                                  new Date(
                                    first.log_date ||
                                      0
                                  )
                              )[0]
                                ?.log_date
                            )
                          : "-"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="muted-text">
                  Select an assigned tender to view its summary.
                </p>
              )}
            </section>
          </section>
        )}

      {!tenderLoading &&
        activeSection ===
          "updates" && (
          <section className="panel">
            <h2>
              My Daily Updates
            </h2>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Notes</th>
                    <th>Photo</th>
                    <th>Status</th>
                    <th>
                      Admin Comment
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {updates.map(
                    (item) => (
                      <tr key={item.id}>
                        <td>
                          {dateOnly(
                            item.log_date
                          )}
                        </td>

                        <td>
                          {item.notes ||
                            "-"}
                        </td>

                        <td>
                          {item.photo_url ? (
                            <a
                              href={
                                item.photo_url
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>

                        <td>
                          <span
                            className={getStatusClass(
                              item.approval_status ||
                                item.status
                            )}
                          >
                            {normaliseStatus(
                              item.approval_status ||
                                item.status
                            )}
                          </span>
                        </td>

                        <td>
                          {item.admin_comment ||
                            "-"}
                        </td>
                      </tr>
                    )
                  )}

                  {updates.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan="5"
                        className="empty-table-message"
                      >
                        No updates submitted for this tender yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

      {!tenderLoading &&
        activeSection ===
          "documents" && (
          <section className="payment-grid">
            <section className="panel">
              <h2>
                Upload Document
              </h2>

              <form
                className="payment-form"
                onSubmit={
                  handleDocumentSubmit
                }
              >
                <label>
                  Document Name

                  <input
                    value={
                      documentForm.document_name
                    }
                    onChange={(event) =>
                      setDocumentForm(
                        (
                          previousForm
                        ) => ({
                          ...previousForm,

                          document_name:
                            event.target
                              .value,
                        })
                      )
                    }
                    disabled={
                      documentSubmitting
                    }
                    required
                  />
                </label>

                <label>
                  Type

                  <select
                    value={
                      documentForm.document_type
                    }
                    onChange={(event) =>
                      setDocumentForm(
                        (
                          previousForm
                        ) => ({
                          ...previousForm,

                          document_type:
                            event.target
                              .value,
                        })
                      )
                    }
                    disabled={
                      documentSubmitting
                    }
                  >
                    <option value="PDF">
                      PDF
                    </option>

                    <option value="Word">
                      Word
                    </option>

                    <option value="JPG">
                      JPG
                    </option>

                    <option value="PNG">
                      PNG
                    </option>

                    <option value="Other">
                      Other
                    </option>
                  </select>
                </label>

                <label>
                  File

                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={
                      handleDocumentFile
                    }
                    disabled={
                      documentSubmitting
                    }
                    required
                  />
                </label>

                {documentFile && (
                  <p className="muted-text">
                    Selected:{" "}
                    {documentFile.name}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={
                    documentSubmitting ||
                    !selectedTender
                  }
                >
                  {documentSubmitting
                    ? "Uploading Document..."
                    : "Upload Document"}
                </button>
              </form>
            </section>

            <section className="panel">
              <h2>
                My Tender Documents
              </h2>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Open</th>
                    </tr>
                  </thead>

                  <tbody>
                    {documents.map(
                      (document) => (
                        <tr
                          key={
                            document.id
                          }
                        >
                          <td>
                            {document.document_name ||
                              "-"}
                          </td>

                          <td>
                            {document.document_type ||
                              "-"}
                          </td>

                          <td>
                            {document.file_url ? (
                              <a
                                href={
                                  document.file_url
                                }
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open
                              </a>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      )
                    )}

                    {documents.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan="3"
                          className="empty-table-message"
                        >
                          No documents uploaded for this tender yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        )}

      {activeSection ===
        "profile" && (
        <section className="panel">
          <h2>My Profile</h2>

          <div className="table-wrapper">
            <table>
              <tbody>
                <tr>
                  <th>Name</th>

                  <td>
                    {subcontractor?.full_name ||
                      user?.full_name ||
                      "-"}
                  </td>
                </tr>

                <tr>
                  <th>Business</th>

                  <td>
                    {subcontractor?.business_name ||
                      "-"}
                  </td>
                </tr>

                <tr>
                  <th>Email</th>

                  <td>
                    {subcontractor?.email ||
                      subcontractor?.login_email ||
                      user?.email ||
                      "-"}
                  </td>
                </tr>

                <tr>
                  <th>Phone</th>

                  <td>
                    {subcontractor?.phone ||
                      "-"}
                  </td>
                </tr>

                <tr>
                  <th>GST Number</th>

                  <td>
                    {subcontractor?.gst_number ||
                      "-"}
                  </td>
                </tr>

                <tr>
                  <th>Bank</th>

                  <td>
                    {subcontractor?.bank_name ||
                      "-"}
                  </td>
                </tr>

                <tr>
                  <th>Status</th>

                  <td>
                    <span
                      className={getStatusClass(
                        subcontractor?.subcontractor_status ||
                          subcontractor?.status
                      )}
                    >
                      {normaliseStatus(
                        subcontractor?.subcontractor_status ||
                          subcontractor?.status
                      )}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

export default SubcontractorPortalPage;