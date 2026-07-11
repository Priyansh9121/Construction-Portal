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

import { useAuth } from "../contexts/AuthContext";

import {
  getSiteById,
} from "../services/siteService";

import {
  createTender,
} from "../services/tenderService";

import {
  getPayments,
} from "../services/paymentService";

import { siteTabs } from "../config/siteTabs";

import FinanceSummaryCards from "../components/finance/FinanceSummaryCards";
import FinanceRecordsTable from "../components/finance/FinanceRecordsTable";
import SiteSummaryCards from "../components/siteDetails/SiteSummaryCards";
import SiteTenderTable from "../components/siteDetails/SiteTenderTable";
import ExportButtons from "../components/export/ExportButtons";

import {
  usePaymentManager,
} from "../hooks/usePaymentManager";

import {
  getRunningTenders,
  getPassedTenders,
  getDueSoonTenders,
  getTenderValue,
} from "../utils/tenderCalculations";

const EMPTY_TENDER_FORM = {
  title: "",
  status: "running",
  due_date: "",
  description: "",
  estimated_value: "",
};

function SiteDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [site, setSite] =
    useState(null);

  const [tenders, setTenders] =
    useState([]);

  const [payments, setPayments] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [loadError, setLoadError] =
    useState("");

  const [addingTender, setAddingTender] =
    useState(false);

  const [activeTab, setActiveTab] =
    useState("running");

  const [searchTerm, setSearchTerm] =
    useState("");

  const [tenderForm, setTenderForm] =
    useState(EMPTY_TENDER_FORM);

  const numericSiteId = Number(id);

  const fetchSiteDetails =
    useCallback(async () => {
      if (
        !id ||
        Number.isNaN(numericSiteId)
      ) {
        setSite(null);
        setTenders([]);
        setPayments([]);
        setLoadError(
          "The selected site ID is invalid."
        );
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setLoadError("");

        const [
          siteResponse,
          paymentResponse,
        ] = await Promise.all([
          getSiteById(id),
          getPayments({
            site_id: id,
          }),
        ]);

        const siteRecord =
          siteResponse?.site ||
          siteResponse?.data?.site ||
          null;

        const tenderRecords =
          siteResponse?.tenders ||
          siteResponse?.data?.tenders ||
          [];

        const paymentRecords =
          Array.isArray(paymentResponse)
            ? paymentResponse
            : paymentResponse?.payments ||
              paymentResponse?.data?.payments ||
              paymentResponse?.data ||
              [];

        setSite(siteRecord);

        setTenders(
          Array.isArray(tenderRecords)
            ? tenderRecords
            : []
        );

        setPayments(
          Array.isArray(paymentRecords)
            ? paymentRecords
            : []
        );

        if (!siteRecord) {
          setLoadError(
            "Site details were not found."
          );
        }
      } catch (error) {
        console.error(
          "Failed to load site details:",
          error.response?.data || error
        );

        const errorMessage =
          error.response?.data?.message ||
          "Failed to load site details.";

        setLoadError(errorMessage);
        setSite(null);
        setTenders([]);
        setPayments([]);
      } finally {
        setLoading(false);
      }
    }, [id, numericSiteId]);

  useEffect(() => {
    fetchSiteDetails();
  }, [fetchSiteDetails]);

  const handleTenderFormChange = (
    event
  ) => {
    const { name, value } =
      event.target;

    setTenderForm(
      (previousForm) => ({
        ...previousForm,
        [name]: value,
      })
    );
  };

  const handleAddTender = async (
    event
  ) => {
    event.preventDefault();

    if (addingTender) {
      return;
    }

    const title =
      tenderForm.title.trim();

    const description =
      tenderForm.description.trim();

    const estimatedValue =
      Number(
        tenderForm.estimated_value ||
          0
      );

    if (!title) {
      toast.error(
        "Tender title is required."
      );
      return;
    }

    if (
      estimatedValue < 0 ||
      Number.isNaN(estimatedValue)
    ) {
      toast.error(
        "Estimated value must be a valid positive amount."
      );
      return;
    }

    if (!user?.company_id) {
      toast.error(
        "Your account is not linked to a company."
      );
      return;
    }

    const selectedStatus =
      tenderForm.status;

    try {
      setAddingTender(true);

      await createTender({
        company_id:
          user.company_id,
        site_id:
          numericSiteId,
        title,
        status:
          selectedStatus,
        due_date:
          tenderForm.due_date ||
          null,
        description,
        estimated_value:
          estimatedValue,
      });

      setTenderForm(
        EMPTY_TENDER_FORM
      );

      await fetchSiteDetails();

      setActiveTab(
        selectedStatus ||
          "running"
      );

      toast.success(
        "Tender added successfully."
      );
    } catch (error) {
      console.error(
        "Failed to add tender:",
        error.response?.data || error
      );

      toast.error(
        error.response?.data?.message ||
          "Failed to add tender."
      );
    } finally {
      setAddingTender(false);
    }
  };

  const runningTenders =
    useMemo(
      () =>
        getRunningTenders(
          tenders
        ),
      [tenders]
    );

  const passedTenders =
    useMemo(
      () =>
        getPassedTenders(
          tenders
        ),
      [tenders]
    );

  const dueSoonTenders =
    useMemo(
      () =>
        getDueSoonTenders(
          tenders
        ),
      [tenders]
    );

  const totalTenderValue =
    useMemo(
      () =>
        Number(
          getTenderValue(
            tenders
          ) || 0
        ),
      [tenders]
    );

  const tendersForActiveTab =
    useMemo(() => {
      if (
        activeTab === "running"
      ) {
        return runningTenders;
      }

      if (
        activeTab === "passed"
      ) {
        return passedTenders;
      }

      if (
        activeTab ===
        "due soon"
      ) {
        return dueSoonTenders;
      }

      if (
        activeTab === "all"
      ) {
        return tenders;
      }

      return tenders.filter(
        (tender) =>
          String(
            tender.status || ""
          )
            .trim()
            .toLowerCase() ===
          String(activeTab)
            .trim()
            .toLowerCase()
      );
    }, [
      activeTab,
      dueSoonTenders,
      passedTenders,
      runningTenders,
      tenders,
    ]);

  const filteredTenders =
    useMemo(() => {
      const search =
        searchTerm
          .trim()
          .toLowerCase();

      if (!search) {
        return tendersForActiveTab;
      }

      return tendersForActiveTab.filter(
        (tender) => {
          const searchableText = [
            tender.title,
            tender.tender_name,
            tender.status,
            tender.description,
            tender.due_date,
            tender.estimated_value,
          ]
            .filter(
              (value) =>
                value !== null &&
                value !== undefined
            )
            .join(" ")
            .toLowerCase();

          return searchableText.includes(
            search
          );
        }
      );
    }, [
      tendersForActiveTab,
      searchTerm,
    ]);

  const {
    filteredPayments,
    summary: paymentSummary,
  } = usePaymentManager({
    payments,
    siteId: id,
  });

  const tenderExportColumns = [
    {
      key: "title",
      label: "Tender",
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
        status:
          tender.status || "",
        due_date:
          tender.due_date
            ? String(
                tender.due_date
              ).slice(0, 10)
            : "",
        estimated_value:
          Number(
            tender.estimated_value ||
              0
          ),
        description:
          tender.description ||
          "",
      })
    );

  const tenderExportSummary = {
    Site:
      site?.site_name ||
      "Unknown site",
    "Total Tenders":
      tenders.length,
    Running:
      runningTenders.length,
    Passed:
      passedTenders.length,
    "Due Soon":
      dueSoonTenders.length,
    "Total Tender Value":
      totalTenderValue,
    "Filtered Tenders":
      filteredTenders.length,
  };

  const resetSearch = () => {
    setSearchTerm("");
  };

  if (loading) {
    return (
      <section className="panel">
        <h2>
          Loading site details...
        </h2>

        <p className="muted-text">
          Loading the site, tenders
          and finance records.
        </p>
      </section>
    );
  }

  if (loadError || !site) {
    return (
      <section className="panel">
        <h2>
          Site could not be loaded
        </h2>

        <p
          className="error"
          role="alert"
        >
          {loadError ||
            "Site not found."}
        </p>

        <div className="form-actions">
          <button
            type="button"
            onClick={
              fetchSiteDetails
            }
          >
            Retry
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={() =>
              navigate("/sites")
            }
          >
            Back to Sites
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="tender-details-page">
      <section className="panel tender-header">
        <div>
          <p className="dashboard-hero-eyebrow">
            Site Project
          </p>

          <h2>
            {site.site_name ||
              "Unnamed Site"}
          </h2>

          <p>
            {site.site_type ||
              "Unspecified type"}{" "}
            ·{" "}
            <span
              className={
                String(
                  site.status || ""
                ).toLowerCase() ===
                "active"
                  ? "badge green"
                  : "badge yellow"
              }
            >
              {site.status ||
                "unknown"}
            </span>
          </p>

          <p className="muted-text">
            {site.address ||
              "No address added"}
          </p>
        </div>

        <div className="report-actions">
          <ExportButtons
            filename={`site-${site.id}-tenders`}
            title={`${site.site_name} Tenders`}
            subtitle="Construction Portal site tender register"
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

          <button
            type="button"
            className="secondary-btn"
            onClick={() =>
              navigate("/sites")
            }
          >
            Back to Sites
          </button>
        </div>
      </section>

      <SiteSummaryCards
        totalTenders={
          tenders.length
        }
        runningTenders={
          runningTenders.length
        }
        passedTenders={
          passedTenders.length
        }
        dueSoonTenders={
          dueSoonTenders.length
        }
        totalValue={
          totalTenderValue.toFixed(
            2
          )
        }
      />

      <section className="payment-grid">
        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                Add Tender to This Site
              </h2>

              <p className="muted-text">
                Create a tender already
                linked to this site.
              </p>
            </div>
          </div>

          <form
            className="payment-form"
            onSubmit={
              handleAddTender
            }
          >
            <div className="form-grid">
              <label>
                Tender Title
                <input
                  name="title"
                  placeholder="Tender title"
                  value={
                    tenderForm.title
                  }
                  onChange={
                    handleTenderFormChange
                  }
                  disabled={
                    addingTender
                  }
                  required
                />
              </label>

              <label>
                Status
                <select
                  name="status"
                  value={
                    tenderForm.status
                  }
                  onChange={
                    handleTenderFormChange
                  }
                  disabled={
                    addingTender
                  }
                  required
                >
                  <option value="running">
                    Running
                  </option>

                  <option value="passed">
                    Passed
                  </option>

                  <option value="pending">
                    Pending
                  </option>

                  <option value="completed">
                    Completed
                  </option>
                </select>
              </label>

              <label>
                Due Date
                <input
                  name="due_date"
                  type="date"
                  value={
                    tenderForm.due_date
                  }
                  onChange={
                    handleTenderFormChange
                  }
                  disabled={
                    addingTender
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
                  placeholder="0.00"
                  value={
                    tenderForm.estimated_value
                  }
                  onChange={
                    handleTenderFormChange
                  }
                  disabled={
                    addingTender
                  }
                />
              </label>
            </div>

            <label>
              Description
              <textarea
                name="description"
                placeholder="Tender description"
                value={
                  tenderForm.description
                }
                onChange={
                  handleTenderFormChange
                }
                disabled={
                  addingTender
                }
              />
            </label>

            <button
              type="submit"
              disabled={
                addingTender
              }
            >
              {addingTender
                ? "Adding..."
                : "Add Tender"}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                Site Tenders
              </h2>

              <p className="muted-text">
                Open a tender to manage
                documents, materials,
                finance, daily progress,
                workers and
                subcontractors.
              </p>
            </div>

            {searchTerm && (
              <button
                type="button"
                className="secondary-btn"
                onClick={
                  resetSearch
                }
              >
                Clear Search
              </button>
            )}
          </div>

          <div className="tabs">
            {siteTabs.map(
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
                >
                  {tab.label}
                </button>
              )
            )}
          </div>

          <input
            className="search-input"
            type="search"
            placeholder="Search tenders by title, status, value, date or description..."
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(
                event.target.value
              )
            }
          />

          <p className="muted-text">
            Showing{" "}
            {filteredTenders.length}{" "}
            tender
            {filteredTenders.length ===
            1
              ? ""
              : "s"}
            .
          </p>

          <SiteTenderTable
            tenders={
              filteredTenders
            }
            onOpenTender={(
              tenderId
            ) =>
              navigate(
                `/tenders/${tenderId}`
              )
            }
          />
        </section>
      </section>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              Site Finance
            </h2>

            <p className="muted-text">
              Finance totals and records
              linked to this site.
            </p>
          </div>
        </div>

        <FinanceSummaryCards
          summary={
            paymentSummary
          }
        />

        <FinanceRecordsTable
          title="Site Finance Records"
          payments={
            filteredPayments
          }
        />
      </section>
    </section>
  );
}

export default SiteDetailsPage;