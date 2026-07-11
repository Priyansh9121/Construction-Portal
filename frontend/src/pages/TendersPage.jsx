import {
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import toast from "react-hot-toast";

import DeleteVerificationModal from "../components/DeleteVerificationModal";
import ExportButtons from "../components/export/ExportButtons";

import {
  updateTender,
} from "../services/tenderService";

import {
  formatCurrency,
} from "../utils/currency";

import {
  useAuth,
} from "../contexts/AuthContext";

import useTenders from "../hooks/useTenders";
import useSites from "../hooks/useSites";

const EMPTY_EDIT_FORM = {
  title: "",
  status: "running",
  due_date: "",
  description: "",
  site_id: "",
  estimated_value: "",
};

function TendersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    tenders = [],
    addTender,
    removeTender,
    fetchTenders,
  } = useTenders(user);

  const {
    sites = [],
  } = useSites(user);

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState(null);

  const [
    editingTender,
    setEditingTender,
  ] = useState(null);

  const [
    activeTab,
    setActiveTab,
  ] = useState("running");

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    editForm,
    setEditForm,
  ] = useState(
    EMPTY_EDIT_FORM
  );

  const [
    adding,
    setAdding,
  ] = useState(false);

  const [
    updating,
    setUpdating,
  ] = useState(false);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const money = formatCurrency;

  const dateOnly = (value) =>
    value
      ? String(value).slice(0, 10)
      : "";

  const normaliseStatus = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();

  const today = useMemo(() => {
    const currentDate = new Date();

    currentDate.setHours(
      0,
      0,
      0,
      0
    );

    return currentDate;
  }, []);

  const next7Days = useMemo(() => {
    const futureDate =
      new Date(today);

    futureDate.setDate(
      futureDate.getDate() + 7
    );

    return futureDate;
  }, [today]);

  const getSiteName = (siteId) => {
    const site = sites.find(
      (item) =>
        Number(item.id) ===
        Number(siteId)
    );

    return (
      site?.site_name ||
      "N/A"
    );
  };

  const runningTenders = useMemo(
    () =>
      tenders.filter(
        (tender) =>
          normaliseStatus(
            tender.status
          ) === "running"
      ),
    [tenders]
  );

  const completedTenders = useMemo(
    () =>
      tenders.filter((tender) =>
        [
          "completed",
          "passed",
        ].includes(
          normaliseStatus(
            tender.status
          )
        )
      ),
    [tenders]
  );

  const pendingTenders = useMemo(
    () =>
      tenders.filter(
        (tender) =>
          normaliseStatus(
            tender.status
          ) === "pending"
      ),
    [tenders]
  );

  const dueSoonTenders = useMemo(
    () =>
      tenders.filter((tender) => {
        if (!tender.due_date) {
          return false;
        }

        const dueDate =
          new Date(
            tender.due_date
          );

        dueDate.setHours(
          0,
          0,
          0,
          0
        );

        const status =
          normaliseStatus(
            tender.status
          );

        return (
          dueDate >= today &&
          dueDate <= next7Days &&
          ![
            "completed",
            "passed",
          ].includes(status)
        );
      }),
    [
      tenders,
      today,
      next7Days,
    ]
  );

  const totalTenderValue = useMemo(
    () =>
      tenders.reduce(
        (sum, tender) =>
          sum +
          Number(
            tender.estimated_value ||
              0
          ),
        0
      ),
    [tenders]
  );

  const filteredTenders = useMemo(() => {
    const search =
      searchTerm
        .trim()
        .toLowerCase();

    return tenders.filter(
      (tender) => {
        const status =
          normaliseStatus(
            tender.status
          );

        const matchesTab =
          activeTab === "due soon"
            ? dueSoonTenders.some(
                (item) =>
                  Number(item.id) ===
                  Number(tender.id)
              )
            : activeTab === "all"
              ? true
              : status === activeTab;

        const siteName = String(
          tender.site_name ||
            getSiteName(
              tender.site_id
            ) ||
            ""
        ).toLowerCase();

        const searchableText = [
          tender.title,
          tender.tender_name,
          status,
          tender.description,
          tender.due_date,
          tender.estimated_value,
          siteName,
        ]
          .filter(
            (value) =>
              value !== null &&
              value !== undefined
          )
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          !search ||
          searchableText.includes(
            search
          );

        return (
          matchesTab &&
          matchesSearch
        );
      }
    );
  }, [
    tenders,
    activeTab,
    dueSoonTenders,
    searchTerm,
    sites,
  ]);

  const filteredTenderValue =
    useMemo(
      () =>
        filteredTenders.reduce(
          (sum, tender) =>
            sum +
            Number(
              tender.estimated_value ||
                0
            ),
          0
        ),
      [filteredTenders]
    );

  const tenderExportColumns = [
    {
      key: "title",
      label: "Tender",
    },
    {
      key: "site_name",
      label: "Site",
    },
    {
      key: "status",
      label: "Status",
    },
    {
      key: "due_date",
      label: "Due Date",
    },
    {
      key: "estimated_value",
      label: "Estimated Value",
    },
    {
      key: "description",
      label: "Description",
    },
  ];

  const tenderExportRows =
    filteredTenders.map(
      (tender) => ({
        title:
          tender.title ||
          tender.tender_name ||
          "",
        site_name:
          tender.site_name ||
          getSiteName(
            tender.site_id
          ),
        status:
          normaliseStatus(
            tender.status
          ),
        due_date:
          dateOnly(
            tender.due_date
          ),
        estimated_value:
          money(
            tender.estimated_value
          ),
        description:
          tender.description ||
          "",
      })
    );

  const tenderExportSummary = {
    "Total Tenders":
      tenders.length,
    Running:
      runningTenders.length,
    Pending:
      pendingTenders.length,
    "Completed / Passed":
      completedTenders.length,
    "Due Soon":
      dueSoonTenders.length,
    "Total Tender Value":
      money(
        totalTenderValue
      ),
    "Filtered Tenders":
      filteredTenders.length,
    "Filtered Value":
      money(
        filteredTenderValue
      ),
  };

  const validateTender = (
    payload
  ) => {
    if (!payload.title) {
      toast.error(
        "Tender title is required."
      );

      return false;
    }

    if (
      ![
        "running",
        "pending",
        "completed",
        "passed",
      ].includes(
        payload.status
      )
    ) {
      toast.error(
        "Select a valid tender status."
      );

      return false;
    }

    if (
      Number.isNaN(
        payload.estimated_value
      ) ||
      payload.estimated_value < 0
    ) {
      toast.error(
        "Estimated value must be zero or greater."
      );

      return false;
    }

    return true;
  };

  const handleAddTender =
    async (event) => {
      event.preventDefault();

      if (adding) {
        return;
      }

      if (
        typeof addTender !==
        "function"
      ) {
        toast.error(
          "Add tender function is unavailable."
        );

        return;
      }

      const form =
        event.currentTarget;

      const newTender = {
        company_id:
          user?.company_id ||
          null,

        site_id:
          form.site_id.value
            ? Number(
                form.site_id.value
              )
            : null,

        title:
          form.title.value.trim(),

        status:
          normaliseStatus(
            form.status.value
          ),

        due_date:
          form.due_date.value ||
          null,

        description:
          form.description.value.trim(),

        estimated_value:
          Number(
            form.estimated_value
              .value || 0
          ),
      };

      if (
        !validateTender(
          newTender
        )
      ) {
        return;
      }

      try {
        setAdding(true);

        await addTender(
          newTender
        );

        form.reset();

        toast.success(
          "Tender added successfully."
        );
      } catch (error) {
        console.error(
          "Failed to add tender:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            "Failed to add tender."
        );
      } finally {
        setAdding(false);
      }
    };

  const handleConfirmDelete =
    async () => {
      if (
        !deleteTarget ||
        deleting
      ) {
        return;
      }

      if (
        typeof removeTender !==
        "function"
      ) {
        toast.error(
          "Delete tender function is unavailable."
        );

        return;
      }

      try {
        setDeleting(true);

        await removeTender(
          deleteTarget.id
        );

        if (
          editingTender?.id ===
          deleteTarget.id
        ) {
          setEditingTender(null);

          setEditForm(
            EMPTY_EDIT_FORM
          );
        }

        setDeleteTarget(null);

        toast.success(
          "Tender deleted successfully."
        );
      } catch (error) {
        console.error(
          "Failed to delete tender:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            "Failed to delete tender."
        );
      } finally {
        setDeleting(false);
      }
    };

  const startEdit = (tender) => {
    if (
      adding ||
      updating ||
      deleting
    ) {
      return;
    }

    setEditingTender(
      tender
    );

    setEditForm({
      title:
        tender.title ||
        tender.tender_name ||
        "",
      status:
        normaliseStatus(
          tender.status
        ) || "running",
      due_date:
        dateOnly(
          tender.due_date
        ),
      description:
        tender.description ||
        "",
      site_id:
        tender.site_id || "",
      estimated_value:
        tender.estimated_value ||
        "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const cancelEdit = () => {
    if (updating) {
      return;
    }

    setEditingTender(null);

    setEditForm(
      EMPTY_EDIT_FORM
    );
  };

  const handleEditChange = (
    event
  ) => {
    const { name, value } =
      event.target;

    setEditForm(
      (previousForm) => ({
        ...previousForm,
        [name]: value,
      })
    );
  };

  const handleUpdateTender =
    async (event) => {
      event.preventDefault();

      if (
        !editingTender ||
        updating
      ) {
        return;
      }

      const updatePayload = {
        company_id:
          editingTender.company_id ||
          user?.company_id ||
          null,

        title:
          editForm.title.trim(),

        status:
          normaliseStatus(
            editForm.status
          ),

        due_date:
          editForm.due_date ||
          null,

        description:
          editForm.description.trim(),

        site_id:
          editForm.site_id
            ? Number(
                editForm.site_id
              )
            : null,

        estimated_value:
          Number(
            editForm.estimated_value ||
              0
          ),
      };

      if (
        !validateTender(
          updatePayload
        )
      ) {
        return;
      }

      try {
        setUpdating(true);

        await updateTender(
          editingTender.id,
          updatePayload
        );

        if (
          typeof fetchTenders ===
          "function"
        ) {
          await fetchTenders();
        }

        setEditingTender(null);

        setEditForm(
          EMPTY_EDIT_FORM
        );

        toast.success(
          "Tender updated successfully."
        );
      } catch (error) {
        console.error(
          "Failed to update tender:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            "Failed to update tender."
        );
      } finally {
        setUpdating(false);
      }
    };

  const resetFilters = () => {
    setActiveTab("running");
    setSearchTerm("");
  };

  const getStatusClass = (
    status
  ) => {
    const value =
      normaliseStatus(status);

    if (value === "running") {
      return "badge green";
    }

    if (value === "pending") {
      return "badge yellow";
    }

    if (
      value === "completed" ||
      value === "passed"
    ) {
      return "badge blue";
    }

    return "badge";
  };

  const isBusy =
    adding ||
    updating ||
    deleting;

  return (
    <>
      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              Tenders Management
            </h2>

            <p className="muted-text">
              Track running, pending,
              completed and due-soon
              tenders with site links
              and estimated values.
            </p>
          </div>

          <ExportButtons
            filename="tenders"
            title="Tenders Report"
            subtitle="Construction Portal tender register"
            rows={
              tenderExportRows
            }
            columns={
              tenderExportColumns
            }
            summary={
              tenderExportSummary
            }
          />
        </div>
      </section>

      <section className="summary-cards">
        <div className="card">
          <p>Total Tenders</p>
          <h2>
            {tenders.length}
          </h2>
        </div>

        <div className="card highlight-success">
          <p>Running</p>
          <h2>
            {
              runningTenders.length
            }
          </h2>
        </div>

        <div className="card">
          <p>
            Completed / Passed
          </p>
          <h2>
            {
              completedTenders.length
            }
          </h2>
        </div>

        <div className="card highlight-warning">
          <p>Pending</p>
          <h2>
            {
              pendingTenders.length
            }
          </h2>
        </div>

        <div className="card highlight-danger">
          <p>Due Soon</p>
          <h2>
            {
              dueSoonTenders.length
            }
          </h2>
        </div>

        <div className="card">
          <p>
            Total Tender Value
          </p>
          <h2>
            {money(
              totalTenderValue
            )}
          </h2>
        </div>

        <div className="card">
          <p>Filtered Value</p>
          <h2>
            {money(
              filteredTenderValue
            )}
          </h2>
        </div>
      </section>

      <section className="payment-grid">
        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                {editingTender
                  ? "Edit Tender"
                  : "Add Tender"}
              </h2>

              <p className="muted-text">
                {editingTender
                  ? "Update tender site, status, due date and estimated value."
                  : "Create a new tender and link it to a site."}
              </p>
            </div>
          </div>

          {editingTender ? (
            <form
              className="payment-form"
              onSubmit={
                handleUpdateTender
              }
            >
              <div className="form-grid">
                <label>
                  Site
                  <select
                    name="site_id"
                    value={
                      editForm.site_id
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      updating
                    }
                  >
                    <option value="">
                      Select Site
                    </option>

                    {sites.map(
                      (site) => (
                        <option
                          key={
                            site.id
                          }
                          value={
                            site.id
                          }
                        >
                          {
                            site.site_name
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  Tender Title
                  <input
                    name="title"
                    value={
                      editForm.title
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      updating
                    }
                    required
                  />
                </label>

                <label>
                  Status
                  <select
                    name="status"
                    value={
                      editForm.status
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      updating
                    }
                    required
                  >
                    <option value="running">
                      Running
                    </option>

                    <option value="pending">
                      Pending
                    </option>

                    <option value="completed">
                      Completed
                    </option>

                    <option value="passed">
                      Passed
                    </option>
                  </select>
                </label>

                <label>
                  Due Date
                  <input
                    name="due_date"
                    type="date"
                    value={
                      editForm.due_date
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      updating
                    }
                  />
                </label>

                <label>
                  Estimated Value
                  <input
                    name="estimated_value"
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      editForm.estimated_value
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      updating
                    }
                  />
                </label>
              </div>

              <label>
                Description
                <textarea
                  name="description"
                  value={
                    editForm.description
                  }
                  onChange={
                    handleEditChange
                  }
                  disabled={
                    updating
                  }
                />
              </label>

              <div className="form-preview-total">
                Estimated Value
                Preview:{" "}
                {money(
                  editForm.estimated_value
                )}
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  disabled={
                    updating
                  }
                >
                  {updating
                    ? "Saving..."
                    : "Save Changes"}
                </button>

                <button
                  type="button"
                  className="secondary-btn"
                  onClick={
                    cancelEdit
                  }
                  disabled={
                    updating
                  }
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <form
              className="payment-form"
              onSubmit={
                handleAddTender
              }
            >
              <div className="form-grid">
                <label>
                  Site
                  <select
                    name="site_id"
                    defaultValue=""
                    disabled={adding}
                  >
                    <option value="">
                      Select Site
                    </option>

                    {sites.map(
                      (site) => (
                        <option
                          key={
                            site.id
                          }
                          value={
                            site.id
                          }
                        >
                          {
                            site.site_name
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  Tender Title
                  <input
                    name="title"
                    placeholder="Tender title"
                    disabled={adding}
                    required
                  />
                </label>

                <label>
                  Status
                  <select
                    name="status"
                    defaultValue="running"
                    disabled={adding}
                    required
                  >
                    <option value="running">
                      Running
                    </option>

                    <option value="pending">
                      Pending
                    </option>

                    <option value="completed">
                      Completed
                    </option>

                    <option value="passed">
                      Passed
                    </option>
                  </select>
                </label>

                <label>
                  Due Date
                  <input
                    name="due_date"
                    type="date"
                    disabled={adding}
                  />
                </label>

                <label>
                  Estimated Value
                  <input
                    name="estimated_value"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    disabled={adding}
                  />
                </label>
              </div>

              <label>
                Description
                <textarea
                  name="description"
                  placeholder="Tender description"
                  disabled={adding}
                />
              </label>

              <button
                type="submit"
                disabled={adding}
              >
                {adding
                  ? "Adding..."
                  : "Add Tender"}
              </button>
            </form>
          )}
        </section>

        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                Tender Filters
              </h2>

              <p className="muted-text">
                Filter by status and
                search title, site,
                value or due date.
              </p>
            </div>

            <button
              type="button"
              className="secondary-btn"
              onClick={
                resetFilters
              }
              disabled={isBusy}
            >
              Reset Filters
            </button>
          </div>

          <div className="tabs">
            {[
              {
                key: "running",
                label: "Running",
              },
              {
                key: "pending",
                label: "Pending",
              },
              {
                key: "completed",
                label: "Completed",
              },
              {
                key: "passed",
                label: "Passed",
              },
              {
                key: "due soon",
                label: "Due Soon",
              },
              {
                key: "all",
                label: "All",
              },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={
                  activeTab === tab.key
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
            ))}
          </div>

          <input
            className="search-input"
            type="search"
            placeholder="Search tenders..."
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(
                event.target.value
              )
            }
            disabled={isBusy}
          />

          <table>
            <tbody>
              <tr>
                <td>
                  Current Filter
                </td>
                <td>
                  {activeTab}
                </td>
              </tr>

              <tr>
                <td>
                  Matching Tenders
                </td>
                <td className="number-cell">
                  {
                    filteredTenders.length
                  }
                </td>
              </tr>

              <tr>
                <td>
                  Matching Value
                </td>
                <td className="amount-cell">
                  {money(
                    filteredTenderValue
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </section>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              Tenders Register
            </h2>

            <p className="muted-text">
              Open a tender to manage
              finance, documents,
              materials, workers and
              subcontractors.
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Tender</th>
                <th>Site</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>
                  Estimated Value
                </th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredTenders.map(
                (tender) => (
                  <tr key={tender.id}>
                    <td>
                      <button
                        type="button"
                        className="table-link-button"
                        onClick={() =>
                          navigate(
                            `/tenders/${tender.id}`
                          )
                        }
                        disabled={
                          isBusy
                        }
                      >
                        {tender.title ||
                          tender.tender_name ||
                          "-"}
                      </button>
                    </td>

                    <td>
                      {tender.site_name ||
                        getSiteName(
                          tender.site_id
                        )}
                    </td>

                    <td>
                      <span
                        className={getStatusClass(
                          tender.status
                        )}
                      >
                        {normaliseStatus(
                          tender.status
                        ) || "-"}
                      </span>
                    </td>

                    <td>
                      {dateOnly(
                        tender.due_date
                      ) || "-"}
                    </td>

                    <td className="amount-cell">
                      {money(
                        tender.estimated_value
                      )}
                    </td>

                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/tenders/${tender.id}`
                            )
                          }
                          disabled={
                            isBusy
                          }
                        >
                          Open
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            startEdit(
                              tender
                            )
                          }
                          disabled={
                            isBusy
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="delete-btn"
                          onClick={() =>
                            setDeleteTarget(
                              tender
                            )
                          }
                          disabled={
                            isBusy
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}

              {filteredTenders.length ===
                0 && (
                <tr>
                  <td
                    colSpan="6"
                    className="empty-table-message"
                  >
                    No tenders found.
                  </td>
                </tr>
              )}
            </tbody>

            {filteredTenders.length >
              0 && (
              <tfoot>
                <tr>
                  <td colSpan="4">
                    <strong>
                      Total
                    </strong>
                  </td>

                  <td className="amount-cell">
                    <strong>
                      {money(
                        filteredTenderValue
                      )}
                    </strong>
                  </td>

                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <DeleteVerificationModal
        open={Boolean(
          deleteTarget
        )}
        itemName={
          deleteTarget?.title ||
          deleteTarget?.tender_name ||
          "tender"
        }
        onCancel={() => {
          if (!deleting) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={
          handleConfirmDelete
        }
        loading={deleting}
      />
    </>
  );
}

export default TendersPage;