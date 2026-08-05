/**
 * File purpose:
 * The tender register: list, filter, create and edit.
 *
 * State:
 * - Local: filters, search, the create/edit form, modal visibility.
 *
 * Hooks and context:
 * - useTenders for the register
 *
 * API endpoints:
 * - GET/POST/PUT/DELETE /tenders via services/tenderService.js
 *
 * Parent:
 * - AppLayout
 *
 * Navigation and children:
 * - Navigates to TenderDetailsPage on selecting a tender.
 *
 * Important notes:
 * - Office-only.
 * - A tender needs at least one site on create; the form enforces that
 * - before submitting, and the backend rejects it otherwise.
 * - Deleting can fail with 409 while workers or subcontractors are still
 * - assigned — the page surfaces that message rather than assuming success.
 */

import {
  useCallback,
  useEffect,
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
  restoreTender,
  getTenders,
} from "../services/tenderService";

import {
  formatCurrency,
} from "../utils/currency";

import { useAuth,  } from "../contexts/authContext";

import useTenders from "../hooks/useTenders";

const createEmptySite = () => ({
  site_name: "",
  site_type: "Personal Site",
  address: "",
  status: "active",
  progress_percent: 0,
});

const createEmptyTenderForm = () => ({
  title: "",
  client_name: "",
  tender_type: "Personal Tender",
  status: "running",
  start_date: "",
  due_date: "",
  estimated_value: "",
  progress_percent: 0,
  description: "",
  sites: [createEmptySite()],
});

/*
 * Pure helpers, hoisted out of the component. Recreated on every render
 * they became invisible dependencies of the memos that call them.
 */
const normaliseSites = (sites) => {
  if (!Array.isArray(sites)) {
    return [];
  }

  return sites.filter(
    (site) => site && !site.is_deleted
  );
};

const getTenderSites = (tender) =>
  normaliseSites(tender?.sites);

const getTenderSiteNames = (tender) => {
  const names = getTenderSites(tender)
    .map((site) => site.site_name)
    .filter(Boolean);

  return names.join(", ");
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

  const [
    addForm,
    setAddForm,
  ] = useState(
    createEmptyTenderForm
  );

  const [
    editForm,
    setEditForm,
  ] = useState(
    createEmptyTenderForm
  );

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

  /*
   * Deleting a tender is a soft delete. Until now there was no way to see
   * one afterwards, so POST /api/tenders/:id/restore could not be reached
   * and a tender removed by mistake was gone as far as anyone using the
   * app could tell.
   */
  const [
    deletedTenders,
    setDeletedTenders,
  ] = useState([]);

  const [
    restoringId,
    setRestoringId,
  ] = useState(null);

  const showingDeleted =
    activeTab === "deleted";

  const loadDeleted = useCallback(
    () =>
      getTenders({ deleted: true })
        .then(setDeletedTenders)
        .catch(() => setDeletedTenders([])),
    []
  );

  useEffect(() => {
    if (showingDeleted) {
      loadDeleted();
    }
  }, [showingDeleted, loadDeleted]);

  const handleRestore = async (tender) => {
    try {
      setRestoringId(tender.id);

      await restoreTender(tender.id);

      toast.success(`${tender.title} restored.`);

      await Promise.all([
        loadDeleted(),
        fetchTenders(),
      ]);
    } catch (error) {
      toast.error(error?.message || "Could not restore that tender.");
    } finally {
      setRestoringId(null);
    }
  };

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

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
    const currentDate =
      new Date();

    currentDate.setHours(
      0,
      0,
      0,
      0
    );

    return currentDate;
  }, []);

  const next7Days =
    useMemo(() => {
      const futureDate =
        new Date(today);

      futureDate.setDate(
        futureDate.getDate() +
          7
      );

      return futureDate;
    }, [today]);

  const runningTenders =
    useMemo(
      () =>
        tenders.filter(
          (tender) =>
            normaliseStatus(
              tender.status
            ) === "running"
        ),
      [tenders]
    );

  const pendingTenders =
    useMemo(
      () =>
        tenders.filter(
          (tender) =>
            normaliseStatus(
              tender.status
            ) === "pending"
        ),
      [tenders]
    );

  const completedTenders =
    useMemo(
      () =>
        tenders.filter(
          (tender) =>
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

  const dueSoonTenders =
    useMemo(
      () =>
        tenders.filter(
          (tender) => {
            if (
              !tender.due_date
            ) {
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
              dueDate <=
                next7Days &&
              ![
                "completed",
                "passed",
              ].includes(status)
            );
          }
        ),
      [
        tenders,
        today,
        next7Days,
      ]
    );

  const totalTenderValue =
    useMemo(
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

  const totalTenderSites =
    useMemo(
      () =>
        tenders.reduce(
          (sum, tender) =>
            sum +
            getTenderSites(
              tender
            ).length,
          0
        ),
      [tenders]
    );

  const filteredTenders =
    useMemo(() => {
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
            activeTab ===
            "due soon"
              ? dueSoonTenders.some(
                  (item) =>
                    Number(
                      item.id
                    ) ===
                    Number(
                      tender.id
                    )
                )
              : activeTab ===
                  "all"
                ? true
                : status ===
                  activeTab;

          const sites =
            getTenderSites(
              tender
            );

          const siteText =
            sites
              .map(
                (site) =>
                  [
                    site.site_name,
                    site.address,
                    site.site_type,
                    site.status,
                  ]
                    .filter(Boolean)
                    .join(" ")
              )
              .join(" ");

          const searchableText =
            [
              tender.title,
              tender.tender_name,
              tender.client_name,
              tender.tender_type,
              tender.status,
              tender.description,
              tender.start_date,
              tender.due_date,
              tender.estimated_value,
              siteText,
            ]
              .filter(
                (value) =>
                  value !== null &&
                  value !==
                    undefined
              )
              .join(" ")
              .toLowerCase();

          return (
            matchesTab &&
            (!search ||
              searchableText.includes(
                search
              ))
          );
        }
      );
    }, [
      tenders,
      activeTab,
      dueSoonTenders,
      searchTerm,
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
      key: "client_name",
      label: "Client",
    },
    {
      key: "tender_type",
      label: "Tender Type",
    },
    {
      key: "site_count",
      label: "Site Count",
    },
    {
      key: "site_names",
      label: "Sites",
    },
    {
      key: "status",
      label: "Status",
    },
    {
      key: "start_date",
      label: "Start Date",
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
      key: "progress_percent",
      label: "Progress",
    },
    {
      key: "description",
      label: "Description",
    },
  ];

  const tenderExportRows =
    filteredTenders.map(
      (tender) => {
        const tenderSites =
          getTenderSites(
            tender
          );

        return {
          title:
            tender.title ||
            tender.tender_name ||
            "",

          client_name:
            tender.client_name ||
            "",

          tender_type:
            tender.tender_type ||
            "",

          site_count:
            tenderSites.length,

          site_names:
            getTenderSiteNames(
              tender
            ),

          status:
            normaliseStatus(
              tender.status
            ),

          start_date:
            dateOnly(
              tender.start_date
            ),

          due_date:
            dateOnly(
              tender.due_date
            ),

          estimated_value:
            money(
              tender.estimated_value
            ),

          progress_percent:
            `${Number(
              tender.progress_percent ||
                0
            )}%`,

          description:
            tender.description ||
            "",
        };
      }
    );

  const tenderExportSummary = {
    "Total Tenders":
      tenders.length,

    "Total Sites":
      totalTenderSites,

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
      payload.estimated_value <
        0
    ) {
      toast.error(
        "Estimated value must be zero or greater."
      );

      return false;
    }

    if (
      Number.isNaN(
        payload.progress_percent
      ) ||
      payload.progress_percent <
        0 ||
      payload.progress_percent >
        100
    ) {
      toast.error(
        "Tender progress must be between 0 and 100."
      );

      return false;
    }

    if (
      !Array.isArray(
        payload.sites
      ) ||
      payload.sites.length ===
        0
    ) {
      toast.error(
        "At least one tender site is required."
      );

      return false;
    }

    for (
      let index = 0;
      index <
      payload.sites.length;
      index += 1
    ) {
      const site =
        payload.sites[index];

      if (!site.site_name) {
        toast.error(
          `Site ${index + 1} name is required.`
        );

        return false;
      }

      if (!site.address) {
        toast.error(
          `Site ${index + 1} address is required.`
        );

        return false;
      }

      const progress =
        Number(
          site.progress_percent ||
            0
        );

      if (
        Number.isNaN(
          progress
        ) ||
        progress < 0 ||
        progress > 100
      ) {
        toast.error(
          `Site ${index + 1} progress must be between 0 and 100.`
        );

        return false;
      }
    }

    return true;
  };

  const buildPayload = (
    form
  ) => ({
    company_id:
      user?.company_id ||
      null,

    title:
      form.title.trim(),

    client_name:
      form.client_name.trim(),

    tender_type:
      form.tender_type ||
      "Personal Tender",

    status:
      normaliseStatus(
        form.status
      ),

    start_date:
      form.start_date ||
      null,

    due_date:
      form.due_date ||
      null,

    estimated_value:
      Number(
        form.estimated_value ||
          0
      ),

    progress_percent:
      Number(
        form.progress_percent ||
          0
      ),

    description:
      form.description.trim(),

    sites:
      form.sites.map(
        (site) => ({
          ...(site.id
            ? {
                id: Number(
                  site.id
                ),
              }
            : {}),

          site_name:
            site.site_name.trim(),

          site_type:
            site.site_type ||
            "Personal Site",

          address:
            site.address.trim(),

          status:
            normaliseStatus(
              site.status
            ) || "active",

          progress_percent:
            Number(
              site.progress_percent ||
                0
            ),
        })
      ),
  });

  const handleAddChange = (
    event
  ) => {
    const { name, value } =
      event.target;

    setAddForm(
      (previous) => ({
        ...previous,
        [name]: value,
      })
    );
  };

  const handleEditChange = (
    event
  ) => {
    const { name, value } =
      event.target;

    setEditForm(
      (previous) => ({
        ...previous,
        [name]: value,
      })
    );
  };

  const updateSiteField = (
    mode,
    index,
    field,
    value
  ) => {
    const setter =
      mode === "edit"
        ? setEditForm
        : setAddForm;

    setter((previous) => ({
      ...previous,

      sites:
        previous.sites.map(
          (site, siteIndex) =>
            siteIndex === index
              ? {
                  ...site,
                  [field]:
                    value,
                }
              : site
        ),
    }));
  };

  const addSiteRow = (
    mode
  ) => {
    const setter =
      mode === "edit"
        ? setEditForm
        : setAddForm;

    setter((previous) => ({
      ...previous,

      sites: [
        ...previous.sites,
        createEmptySite(),
      ],
    }));
  };

  const removeSiteRow = (
    mode,
    index
  ) => {
    const setter =
      mode === "edit"
        ? setEditForm
        : setAddForm;

    setter((previous) => {
      if (
        previous.sites.length <=
        1
      ) {
        toast.error(
          "A tender must contain at least one site."
        );

        return previous;
      }

      return {
        ...previous,

        sites:
          previous.sites.filter(
            (
              _site,
              siteIndex
            ) =>
              siteIndex !== index
          ),
      };
    });
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

      const payload =
        buildPayload(
          addForm
        );

      if (
        !validateTender(
          payload
        )
      ) {
        return;
      }

      try {
        setAdding(true);

        await addTender(
          payload
        );

        setAddForm(
          createEmptyTenderForm()
        );

        toast.success(
          "Tender and sites created successfully."
        );
      } catch (error) {
        console.error(
          "Failed to add tender:",
          error?.response?.data ||
            error
        );

        toast.error(
          error?.response?.data
            ?.message ||
            error?.message ||
            "Failed to create tender."
        );
      } finally {
        setAdding(false);
      }
    };

  const startEdit = (
    tender
  ) => {
    if (
      adding ||
      updating ||
      deleting
    ) {
      return;
    }

    const tenderSites =
      getTenderSites(
        tender
      );

    setEditingTender(
      tender
    );

    setEditForm({
      title:
        tender.title ||
        tender.tender_name ||
        "",

      client_name:
        tender.client_name ||
        "",

      tender_type:
        tender.tender_type ||
        "Personal Tender",

      status:
        normaliseStatus(
          tender.status
        ) || "running",

      start_date:
        dateOnly(
          tender.start_date
        ),

      due_date:
        dateOnly(
          tender.due_date
        ),

      estimated_value:
        tender.estimated_value ??
        "",

      progress_percent:
        Number(
          tender.progress_percent ||
            0
        ),

      description:
        tender.description ||
        "",

      sites:
        tenderSites.length > 0
          ? tenderSites.map(
              (site) => ({
                id: site.id,

                site_name:
                  site.site_name ||
                  "",

                site_type:
                  site.site_type ||
                  "Personal Site",

                address:
                  site.address ||
                  "",

                status:
                  normaliseStatus(
                    site.status
                  ) || "active",

                progress_percent:
                  Number(
                    site.progress_percent ||
                      0
                  ),
              })
            )
          : [
              createEmptySite(),
            ],
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
      createEmptyTenderForm()
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

      const payload = {
        ...buildPayload(
          editForm
        ),

        company_id:
          editingTender.company_id ||
          user?.company_id ||
          null,
      };

      if (
        !validateTender(
          payload
        )
      ) {
        return;
      }

      try {
        setUpdating(true);

        await updateTender(
          editingTender.id,
          payload
        );

        if (
          typeof fetchTenders ===
          "function"
        ) {
          await fetchTenders();
        }

        setEditingTender(null);

        setEditForm(
          createEmptyTenderForm()
        );

        toast.success(
          "Tender and sites updated successfully."
        );
      } catch (error) {
        console.error(
          "Failed to update tender:",
          error?.response?.data ||
            error
        );

        toast.error(
          error?.response?.data
            ?.message ||
            error?.message ||
            "Failed to update tender."
        );
      } finally {
        setUpdating(false);
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
          Number(
            editingTender?.id
          ) ===
          Number(
            deleteTarget.id
          )
        ) {
          setEditingTender(
            null
          );

          setEditForm(
            createEmptyTenderForm()
          );
        }

        setDeleteTarget(
          null
        );

        toast.success(
          "Tender and associated sites deleted successfully."
        );
      } catch (error) {
        console.error(
          "Failed to delete tender:",
          error?.response?.data ||
            error
        );

        toast.error(
          error?.response?.data
            ?.message ||
            error?.message ||
            "Failed to delete tender."
        );
      } finally {
        setDeleting(false);
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
      normaliseStatus(
        status
      );

    if (
      value === "running"
    ) {
      return "badge green";
    }

    if (
      value === "pending"
    ) {
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

  const getSiteStatusClass = (
    status
  ) => {
    const value =
      normaliseStatus(
        status
      );

    if (
      value === "active" ||
      value === "completed"
    ) {
      return "badge green";
    }

    if (
      value === "planned" ||
      value === "paused"
    ) {
      return "badge yellow";
    }

    if (
      value === "cancelled" ||
      value === "inactive"
    ) {
      return "badge red";
    }

    return "badge blue";
  };

  const renderSitesForm = (
    mode,
    form,
    disabled
  ) => (
    <section className="panel">
      <div className="section-title-row">
        <div>
          <h3>
            Tender Sites
          </h3>

          <p className="muted-text">
            Add every physical site
            belonging to this tender.
          </p>
        </div>

        <button
          type="button"
          className="secondary-btn"
          onClick={() =>
            addSiteRow(mode)
          }
          disabled={disabled}
        >
          Add Another Site
        </button>
      </div>

      {form.sites.map(
        (site, index) => (
          <div
            key={
              site.id ||
              `${mode}-site-${index}`
            }
            className="panel"
          >
            <div className="section-title-row">
              <div>
                <h3>
                  Site {index + 1}
                </h3>

                {site.id && (
                  <p className="muted-text">
                    Existing site ID:{" "}
                    {site.id}
                  </p>
                )}
              </div>

              <button
                type="button"
                className="delete-btn"
                onClick={() =>
                  removeSiteRow(
                    mode,
                    index
                  )
                }
                disabled={
                  disabled ||
                  form.sites.length <=
                    1
                }
              >
                Remove Site
              </button>
            </div>

            <div className="form-grid">
              <label>
                Site Name

                <input
                  value={
                    site.site_name
                  }
                  onChange={(
                    event
                  ) =>
                    updateSiteField(
                      mode,
                      index,
                      "site_name",
                      event.target
                        .value
                    )
                  }
                  placeholder="Enter site name"
                  disabled={
                    disabled
                  }
                  required
                />
              </label>

              <label>
                Site Type

                <select
                  value={
                    site.site_type
                  }
                  onChange={(
                    event
                  ) =>
                    updateSiteField(
                      mode,
                      index,
                      "site_type",
                      event.target
                        .value
                    )
                  }
                  disabled={
                    disabled
                  }
                >
                  <option value="Personal Site">
                    Personal Site
                  </option>

                  <option value="Subcontractor Site">
                    Subcontractor Site
                  </option>
                </select>
              </label>

              <label>
                Site Status

                <select
                  value={
                    site.status
                  }
                  onChange={(
                    event
                  ) =>
                    updateSiteField(
                      mode,
                      index,
                      "status",
                      event.target
                        .value
                    )
                  }
                  disabled={
                    disabled
                  }
                >
                  <option value="active">
                    Active
                  </option>

                  <option value="planned">
                    Planned
                  </option>

                  <option value="paused">
                    Paused
                  </option>

                  <option value="completed">
                    Completed
                  </option>

                  <option value="inactive">
                    Inactive
                  </option>

                  <option value="cancelled">
                    Cancelled
                  </option>
                </select>
              </label>

              <label>
                Site Progress %

                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={
                    site.progress_percent
                  }
                  onChange={(
                    event
                  ) =>
                    updateSiteField(
                      mode,
                      index,
                      "progress_percent",
                      event.target
                        .value
                    )
                  }
                  disabled={
                    disabled
                  }
                />
              </label>
            </div>

            <label>
              Site Address

              <textarea
                value={
                  site.address
                }
                onChange={(
                  event
                ) =>
                  updateSiteField(
                    mode,
                    index,
                    "address",
                    event.target
                      .value
                  )
                }
                placeholder="Enter complete site address"
                disabled={
                  disabled
                }
                required
              />
            </label>

            <div className="form-preview-total">
              Site Progress:{" "}
              {Number(
                site.progress_percent ||
                  0
              )}
              %
            </div>
          </div>
        )
      )}
    </section>
  );

  const isBusy =
    adding ||
    updating ||
    deleting;

  const currentForm =
    editingTender
      ? editForm
      : addForm;

  const currentChangeHandler =
    editingTender
      ? handleEditChange
      : handleAddChange;

  const currentSubmitHandler =
    editingTender
      ? handleUpdateTender
      : handleAddTender;

  return (
    <>
      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              Tenders Management
            </h2>

            <p className="muted-text">
              Manage construction
              tenders, tender values,
              deadlines and multiple
              physical sites.
            </p>
          </div>

          <ExportButtons
            filename="tenders"
            title="Tenders Report"
            subtitle="Construction Portal tender and site register"
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

        <div className="card">
          <p>Total Sites</p>

          <h2>
            {totalTenderSites}
          </h2>
        </div>

        <div className="card highlight-success">
          <p>Running</p>

          <h2>
            {runningTenders.length}
          </h2>
        </div>

        <div className="card highlight-warning">
          <p>Pending</p>

          <h2>
            {pendingTenders.length}
          </h2>
        </div>

        <div className="card">
          <p>
            Completed / Passed
          </p>

          <h2>
            {completedTenders.length}
          </h2>
        </div>

        <div className="card highlight-danger">
          <p>Due Soon</p>

          <h2>
            {dueSoonTenders.length}
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

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              {editingTender
                ? "Edit Tender"
                : "Create Tender"}
            </h2>

            <p className="muted-text">
              {editingTender
                ? "Update tender information and synchronise its attached sites."
                : "Create one tender with one or more construction sites."}
            </p>
          </div>

          {editingTender && (
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
              Cancel Editing
            </button>
          )}
        </div>

        <form
          className="payment-form"
          onSubmit={
            currentSubmitHandler
          }
        >
          <div className="form-grid">
            <label>
              Tender Title

              <input
                name="title"
                value={
                  currentForm.title
                }
                onChange={
                  currentChangeHandler
                }
                placeholder="Enter tender title"
                disabled={
                  editingTender
                    ? updating
                    : adding
                }
                required
              />
            </label>

            <label>
              Client Name

              <input
                name="client_name"
                value={
                  currentForm.client_name
                }
                onChange={
                  currentChangeHandler
                }
                placeholder="Enter client name"
                disabled={
                  editingTender
                    ? updating
                    : adding
                }
              />
            </label>

            <label>
              Tender Type

              <select
                name="tender_type"
                value={
                  currentForm.tender_type
                }
                onChange={
                  currentChangeHandler
                }
                disabled={
                  editingTender
                    ? updating
                    : adding
                }
              >
                <option value="Personal Tender">
                  Personal Tender
                </option>

                <option value="Subcontractor Tender">
                  Subcontractor Tender
                </option>
              </select>
            </label>

            <label>
              Tender Status

              <select
                name="status"
                value={
                  currentForm.status
                }
                onChange={
                  currentChangeHandler
                }
                disabled={
                  editingTender
                    ? updating
                    : adding
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
              Start Date

              <input
                name="start_date"
                type="date"
                value={
                  currentForm.start_date
                }
                onChange={
                  currentChangeHandler
                }
                disabled={
                  editingTender
                    ? updating
                    : adding
                }
              />
            </label>

            <label>
              Due Date

              <input
                name="due_date"
                type="date"
                value={
                  currentForm.due_date
                }
                onChange={
                  currentChangeHandler
                }
                disabled={
                  editingTender
                    ? updating
                    : adding
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
                  currentForm.estimated_value
                }
                onChange={
                  currentChangeHandler
                }
                placeholder="0.00"
                disabled={
                  editingTender
                    ? updating
                    : adding
                }
              />
            </label>

            <label>
              Tender Progress %

              <input
                name="progress_percent"
                type="number"
                min="0"
                max="100"
                step="1"
                value={
                  currentForm.progress_percent
                }
                onChange={
                  currentChangeHandler
                }
                disabled={
                  editingTender
                    ? updating
                    : adding
                }
              />
            </label>
          </div>

          <label>
            Tender Description

            <textarea
              name="description"
              value={
                currentForm.description
              }
              onChange={
                currentChangeHandler
              }
              placeholder="Enter tender description"
              disabled={
                editingTender
                  ? updating
                  : adding
              }
            />
          </label>

          <div className="form-preview-total">
            Estimated Value:{" "}
            {money(
              currentForm.estimated_value
            )}
            {" | "}
            Tender Sites:{" "}
            {
              currentForm.sites
                .length
            }
          </div>

          {renderSitesForm(
            editingTender
              ? "edit"
              : "add",

            currentForm,

            editingTender
              ? updating
              : adding
          )}

          <div className="form-actions">
            <button
              type="submit"
              disabled={
                editingTender
                  ? updating
                  : adding
              }
            >
              {editingTender
                ? updating
                  ? "Saving..."
                  : "Save Tender Changes"
                : adding
                  ? "Creating..."
                  : "Create Tender"}
            </button>

            {editingTender && (
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
            )}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              Tender Filters
            </h2>

            <p className="muted-text">
              Search tenders by title,
              client, tender type,
              site, address, status,
              value or date.
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
            {
              key: "deleted",
              label: "Deleted",
            },
          ].map((tab) => (
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
          ))}
        </div>

        <input
          className="search-input"
          type="search"
          placeholder="Search tenders and sites..."
          value={searchTerm}
          onChange={(event) =>
            setSearchTerm(
              event.target.value
            )
          }
          disabled={isBusy}
        />
      </section>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              Tenders Register
            </h2>

            <p className="muted-text">
              Open a tender to manage
              its sites, finance,
              documents, materials,
              workers and
              subcontractors.
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Tender</th>
                <th>Client</th>
                <th>Sites</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Due Date</th>
                <th>
                  Estimated Value
                </th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {(showingDeleted
                ? deletedTenders
                : filteredTenders
              ).map(
                (tender) => {
                  const tenderSites =
                    getTenderSites(
                      tender
                    );

                  return (
                    <tr
                      key={
                        tender.id
                      }
                    >
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

                        <p className="muted-text">
                          {tender.tender_type ||
                            "Tender"}
                        </p>
                      </td>

                      <td>
                        {tender.client_name ||
                          "-"}
                      </td>

                      <td>
                        <strong>
                          {
                            tenderSites.length
                          }{" "}
                          Site
                          {tenderSites.length ===
                          1
                            ? ""
                            : "s"}
                        </strong>

                        <p className="muted-text">
                          {getTenderSiteNames(
                            tender
                          ) ||
                            "No active sites"}
                        </p>
                      </td>

                      <td>
                        <span
                          className={
                            getStatusClass(
                              tender.status
                            )
                          }
                        >
                          {normaliseStatus(
                            tender.status
                          ) || "-"}
                        </span>
                      </td>

                      <td>
                        {Number(
                          tender.progress_percent ||
                            0
                        )}
                        %
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

                          {showingDeleted ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleRestore(
                                  tender
                                )
                              }
                              disabled={
                                restoringId ===
                                tender.id
                              }
                            >
                              {restoringId ===
                              tender.id
                                ? "Restoring..."
                                : "Restore"}
                            </button>
                          ) : (
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
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }
              )}

              {filteredTenders.length ===
                0 && (
                <tr>
                  <td
                    colSpan="8"
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
                  <td colSpan="6">
                    <strong>
                      Filtered Total
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

        {filteredTenders.map(
          (tender) => {
            const tenderSites =
              getTenderSites(
                tender
              );

            if (
              tenderSites.length ===
              0
            ) {
              return null;
            }

            return (
              <details
                key={`tender-sites-${tender.id}`}
                className="panel"
              >
                <summary>
                  {tender.title ||
                    tender.tender_name ||
                    `Tender ${tender.id}`}{" "}
                  —{" "}
                  {
                    tenderSites.length
                  }{" "}
                  Site
                  {tenderSites.length ===
                  1
                    ? ""
                    : "s"}
                </summary>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>
                          Site Name
                        </th>
                        <th>
                          Address
                        </th>
                        <th>
                          Type
                        </th>
                        <th>
                          Status
                        </th>
                        <th>
                          Progress
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {tenderSites.map(
                        (site) => (
                          <tr
                            key={
                              site.id
                            }
                          >
                            <td>
                              {site.site_name ||
                                "-"}
                            </td>

                            <td>
                              {site.address ||
                                "-"}
                            </td>

                            <td>
                              {site.site_type ||
                                "-"}
                            </td>

                            <td>
                              <span
                                className={
                                  getSiteStatusClass(
                                    site.status
                                  )
                                }
                              >
                                {normaliseStatus(
                                  site.status
                                ) ||
                                  "-"}
                              </span>
                            </td>

                            <td>
                              {Number(
                                site.progress_percent ||
                                  0
                              )}
                              %
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          }
        )}
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
            setDeleteTarget(
              null
            );
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