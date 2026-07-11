import {
  useEffect,
  useMemo,
  useState,
} from "react";

import toast from "react-hot-toast";

import {
  getDailyUpdateApprovals,
  approveDailyUpdate,
  rejectDailyUpdate,
} from "../services/dailyUpdateApprovalService";

import ExportButtons from "../components/export/ExportButtons";
import ApprovalActionModal from "../components/ApprovalActionModal";

function DailyUpdateApprovalsPage() {
  const [approvals, setApprovals] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [processing, setProcessing] =
    useState(false);

  const [loadError, setLoadError] =
    useState("");

  const [
    approveTarget,
    setApproveTarget,
  ] = useState(null);

  const [
    rejectTarget,
    setRejectTarget,
  ] = useState(null);

  const [
    selectedApproval,
    setSelectedApproval,
  ] = useState(null);

  const [
    adminComment,
    setAdminComment,
  ] = useState("");

  const [
    confirmCode,
    setConfirmCode,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("pending");

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    photoFilter,
    setPhotoFilter,
  ] = useState("all");

  const [fromDate, setFromDate] =
    useState("");

  const [toDate, setToDate] =
    useState("");

  const dateOnly = (value) =>
    value
      ? String(value).slice(0, 10)
      : "-";

  const normaliseStatus = (value) =>
    String(value || "pending")
      .trim()
      .toLowerCase();

  const getStatusClass = (status) => {
    const value =
      normaliseStatus(status);

    if (value === "approved") {
      return "badge green";
    }

    if (value === "rejected") {
      return "badge red";
    }

    return "badge yellow";
  };

  const loadApprovals = async ({
    showLoader = true,
  } = {}) => {
    try {
      if (showLoader) {
        setLoading(true);
      }

      setLoadError("");

      const data =
        await getDailyUpdateApprovals(
          "all"
        );

      setApprovals(
        data.approvals || []
      );
    } catch (error) {
      console.error(
        "Failed to load daily update approvals:",
        error.response?.data || error
      );

      const errorMessage =
        error.response?.data?.message ||
        "Failed to load daily update approvals.";

      setLoadError(errorMessage);

      if (!showLoader) {
        toast.error(errorMessage);
      }
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const totals = useMemo(() => {
    const pending =
      approvals.filter(
        (item) =>
          normaliseStatus(
            item.status
          ) === "pending"
      );

    const approved =
      approvals.filter(
        (item) =>
          normaliseStatus(
            item.status
          ) === "approved"
      );

    const rejected =
      approvals.filter(
        (item) =>
          normaliseStatus(
            item.status
          ) === "rejected"
      );

    const withPhotos =
      approvals.filter(
        (item) =>
          Boolean(item.photo_url)
      );

    const today = new Date()
      .toISOString()
      .slice(0, 10);

    const todayRequests =
      approvals.filter(
        (item) =>
          dateOnly(
            item.log_date ||
              item.created_at
          ) === today
      );

    return {
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      withPhotos:
        withPhotos.length,
      withoutPhotos:
        approvals.length -
        withPhotos.length,
      today:
        todayRequests.length,
    };
  }, [approvals]);

  const filteredApprovals =
    useMemo(() => {
      const search =
        searchTerm
          .trim()
          .toLowerCase();

      return [...approvals]
        .filter((approval) => {
          const status =
            normaliseStatus(
              approval.status
            );

          const approvalDate =
            dateOnly(
              approval.log_date ||
                approval.created_at
            );

          const searchableText = [
            approval.worker_name,
            approval.site_name,
            approval.tender_title,
            approval.tender_name,
            approval.notes,
            approval.reason,
            approval.admin_comment,
            status,
            approvalDate,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesStatus =
            statusFilter === "all" ||
            status === statusFilter;

          const matchesSearch =
            !search ||
            searchableText.includes(
              search
            );

          const matchesPhoto =
            photoFilter === "all" ||
            (photoFilter ===
              "with-photo" &&
              Boolean(
                approval.photo_url
              )) ||
            (photoFilter ===
              "without-photo" &&
              !approval.photo_url);

          const matchesFromDate =
            !fromDate ||
            approvalDate >=
              fromDate;

          const matchesToDate =
            !toDate ||
            approvalDate <= toDate;

          return (
            matchesStatus &&
            matchesSearch &&
            matchesPhoto &&
            matchesFromDate &&
            matchesToDate
          );
        })
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
        );
    }, [
      approvals,
      statusFilter,
      searchTerm,
      photoFilter,
      fromDate,
      toDate,
    ]);

  const filteredPhotoCount =
    useMemo(
      () =>
        filteredApprovals.filter(
          (approval) =>
            Boolean(
              approval.photo_url
            )
        ).length,
      [filteredApprovals]
    );

  const approvalExportColumns = [
    {
      key: "worker_name",
      label: "Worker",
    },
    {
      key: "site_name",
      label: "Site",
    },
    {
      key: "tender_title",
      label: "Tender",
    },
    {
      key: "log_date",
      label: "Date",
    },
    {
      key: "notes",
      label: "Notes",
    },
    {
      key: "reason",
      label: "Reason",
    },
    {
      key: "status",
      label: "Status",
    },
    {
      key: "photo_status",
      label: "Photo",
    },
    {
      key: "photo_url",
      label: "Photo URL",
    },
    {
      key: "admin_comment",
      label: "Admin Comment",
    },
  ];

  const approvalExportRows =
    filteredApprovals.map(
      (approval) => ({
        worker_name:
          approval.worker_name ||
          "",
        site_name:
          approval.site_name || "",
        tender_title:
          approval.tender_title ||
          approval.tender_name ||
          "",
        log_date: dateOnly(
          approval.log_date ||
            approval.created_at
        ),
        notes:
          approval.notes || "",
        reason:
          approval.reason || "",
        status:
          normaliseStatus(
            approval.status
          ),
        photo_status:
          approval.photo_url
            ? "Available"
            : "Not available",
        photo_url:
          approval.photo_url || "",
        admin_comment:
          approval.admin_comment ||
          "",
      })
    );

  const approvalExportSummary = {
    "Total Approval Requests":
      approvals.length,
    Pending: totals.pending,
    Approved: totals.approved,
    Rejected: totals.rejected,
    "Requests With Photos":
      totals.withPhotos,
    "Requests Without Photos":
      totals.withoutPhotos,
    "Today's Requests":
      totals.today,
    "Filtered Records":
      filteredApprovals.length,
  };

  const closeModal = () => {
    if (processing) return;

    setApproveTarget(null);
    setRejectTarget(null);
    setAdminComment("");
    setConfirmCode("");
  };

  const openApproveModal = (
    approval
  ) => {
    if (processing) return;

    setRejectTarget(null);
    setAdminComment("");
    setConfirmCode("");
    setApproveTarget(approval);
  };

  const openRejectModal = (
    approval
  ) => {
    if (processing) return;

    setApproveTarget(null);
    setAdminComment("");
    setConfirmCode("");
    setRejectTarget(approval);
  };

  const updateSelectedApproval = (
    id,
    status,
    comment
  ) => {
    if (
      selectedApproval?.id !== id
    ) {
      return;
    }

    setSelectedApproval(
      (previous) =>
        previous
          ? {
              ...previous,
              status,
              admin_comment:
                comment || "",
            }
          : null
    );
  };

  const handleApprove =
    async () => {
      if (
        !approveTarget ||
        processing
      ) {
        return;
      }

      const targetId =
        approveTarget.id;

      const comment =
        adminComment.trim();

      try {
        setProcessing(true);

        await approveDailyUpdate(
          targetId,
          comment
        );

        updateSelectedApproval(
          targetId,
          "approved",
          comment
        );

        setApproveTarget(null);
        setRejectTarget(null);
        setAdminComment("");
        setConfirmCode("");

        toast.success(
          "Daily update approved successfully."
        );

        await loadApprovals({
          showLoader: false,
        });
      } catch (error) {
        console.error(
          "Failed to approve daily update:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            "Failed to approve daily update."
        );
      } finally {
        setProcessing(false);
      }
    };

  const handleReject =
    async () => {
      if (
        !rejectTarget ||
        processing
      ) {
        return;
      }

      const targetId =
        rejectTarget.id;

      const comment =
        adminComment.trim();

      if (!comment) {
        toast.error(
          "Please enter a reason or administrator comment before rejecting."
        );

        return;
      }

      try {
        setProcessing(true);

        await rejectDailyUpdate(
          targetId,
          comment
        );

        updateSelectedApproval(
          targetId,
          "rejected",
          comment
        );

        setApproveTarget(null);
        setRejectTarget(null);
        setAdminComment("");
        setConfirmCode("");

        toast.success(
          "Daily update rejected successfully."
        );

        await loadApprovals({
          showLoader: false,
        });
      } catch (error) {
        console.error(
          "Failed to reject daily update:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            "Failed to reject daily update."
        );
      } finally {
        setProcessing(false);
      }
    };

  const resetFilters = () => {
    setSearchTerm("");
    setPhotoFilter("all");
    setFromDate("");
    setToDate("");
  };

  const statusTabs = [
    {
      key: "pending",
      label: "Pending",
      count: totals.pending,
    },
    {
      key: "approved",
      label: "Approved",
      count: totals.approved,
    },
    {
      key: "rejected",
      label: "Rejected",
      count: totals.rejected,
    },
    {
      key: "all",
      label: "All",
      count: approvals.length,
    },
  ];

  if (loading) {
    return (
      <div className="panel">
        Loading approvals...
      </div>
    );
  }

  return (
    <>
      {loadError && (
        <section className="panel">
          <p
            className="error"
            role="alert"
          >
            {loadError}
          </p>

          <button
            type="button"
            onClick={() =>
              loadApprovals()
            }
          >
            Retry
          </button>
        </section>
      )}

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              Daily Update Approvals
            </h2>

            <p className="muted-text">
              Review worker site
              updates, inspect progress
              photos and approve or
              reject submitted records.
            </p>
          </div>

          <ExportButtons
            filename="daily-update-approvals"
            title="Daily Update Approvals Report"
            subtitle="Construction Portal approval register"
            rows={
              approvalExportRows
            }
            columns={
              approvalExportColumns
            }
            summary={
              approvalExportSummary
            }
          />
        </div>
      </section>

      <section className="summary-cards">
        <div className="card">
          <p>Total Requests</p>
          <h2>
            {approvals.length}
          </h2>
        </div>

        <div className="card highlight-warning">
          <p>Pending</p>
          <h2>
            {totals.pending}
          </h2>
        </div>

        <div className="card highlight-success">
          <p>Approved</p>
          <h2>
            {totals.approved}
          </h2>
        </div>

        <div className="card highlight-danger">
          <p>Rejected</p>
          <h2>
            {totals.rejected}
          </h2>
        </div>

        <div className="card">
          <p>With Photos</p>
          <h2>
            {totals.withPhotos}
          </h2>
        </div>

        <div className="card">
          <p>Without Photos</p>
          <h2>
            {totals.withoutPhotos}
          </h2>
        </div>

        <div className="card">
          <p>Today's Requests</p>
          <h2>
            {totals.today}
          </h2>
        </div>

        <div className="card">
          <p>Filtered Records</p>
          <h2>
            {
              filteredApprovals.length
            }
          </h2>
        </div>
      </section>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              Approval Filters
            </h2>

            <p className="muted-text">
              Filter by approval
              status, worker, site,
              tender, photo availability
              or date.
            </p>
          </div>

          <button
            type="button"
            className="secondary-btn"
            onClick={resetFilters}
            disabled={processing}
          >
            Reset Filters
          </button>
        </div>

        <div className="tabs">
          {statusTabs.map(
            (tab) => (
              <button
                key={tab.key}
                type="button"
                className={
                  statusFilter ===
                  tab.key
                    ? "active-tab"
                    : ""
                }
                onClick={() =>
                  setStatusFilter(
                    tab.key
                  )
                }
                disabled={
                  processing
                }
              >
                {tab.label} (
                {tab.count})
              </button>
            )
          )}
        </div>

        <div className="form-grid">
          <label>
            Search
            <input
              className="search-input"
              type="search"
              placeholder="Search worker, site, tender, notes, reason..."
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(
                  event.target.value
                )
              }
            />
          </label>

          <label>
            Photo Status
            <select
              value={photoFilter}
              onChange={(event) =>
                setPhotoFilter(
                  event.target.value
                )
              }
            >
              <option value="all">
                All Updates
              </option>

              <option value="with-photo">
                With Photo
              </option>

              <option value="without-photo">
                Without Photo
              </option>
            </select>
          </label>

          <label>
            From Date
            <input
              type="date"
              value={fromDate}
              onChange={(event) =>
                setFromDate(
                  event.target.value
                )
              }
            />
          </label>

          <label>
            To Date
            <input
              type="date"
              value={toDate}
              onChange={(event) =>
                setToDate(
                  event.target.value
                )
              }
            />
          </label>
        </div>

        <table>
          <tbody>
            <tr>
              <td>
                Current Status Filter
              </td>

              <td>
                {statusFilter}
              </td>
            </tr>

            <tr>
              <td>
                Matching Records
              </td>

              <td className="number-cell">
                {
                  filteredApprovals.length
                }
              </td>
            </tr>

            <tr>
              <td>
                Matching Photos
              </td>

              <td className="number-cell">
                {filteredPhotoCount}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {selectedApproval && (
        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                Approval Request Preview
              </h2>

              <p className="muted-text">
                Review the complete
                daily update before
                making an approval
                decision.
              </p>
            </div>

            <div className="report-actions">
              {normaliseStatus(
                selectedApproval.status
              ) === "pending" && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      openApproveModal(
                        selectedApproval
                      )
                    }
                    disabled={
                      processing
                    }
                  >
                    Approve
                  </button>

                  <button
                    type="button"
                    className="delete-btn"
                    onClick={() =>
                      openRejectModal(
                        selectedApproval
                      )
                    }
                    disabled={
                      processing
                    }
                  >
                    Reject
                  </button>
                </>
              )}

              <button
                type="button"
                className="secondary-btn"
                onClick={() =>
                  setSelectedApproval(
                    null
                  )
                }
                disabled={processing}
              >
                Close Preview
              </button>
            </div>
          </div>

          <section className="summary-cards">
            <div className="card">
              <p>Worker</p>
              <h2>
                {selectedApproval.worker_name ||
                  "-"}
              </h2>
            </div>

            <div className="card">
              <p>Site</p>
              <h2>
                {selectedApproval.site_name ||
                  "-"}
              </h2>
            </div>

            <div className="card">
              <p>Tender</p>
              <h2>
                {selectedApproval.tender_title ||
                  selectedApproval.tender_name ||
                  "-"}
              </h2>
            </div>

            <div className="card">
              <p>Update Date</p>
              <h2>
                {dateOnly(
                  selectedApproval.log_date ||
                    selectedApproval.created_at
                )}
              </h2>
            </div>

            <div className="card">
              <p>Status</p>

              <h2>
                <span
                  className={getStatusClass(
                    selectedApproval.status
                  )}
                >
                  {normaliseStatus(
                    selectedApproval.status
                  )}
                </span>
              </h2>
            </div>
          </section>

          <div className="payment-grid">
            <div className="panel">
              <h3>Update Details</h3>

              <div className="table-wrapper">
                <table>
                  <tbody>
                    <tr>
                      <th>Worker</th>
                      <td>
                        {selectedApproval.worker_name ||
                          "-"}
                      </td>
                    </tr>

                    <tr>
                      <th>Site</th>
                      <td>
                        {selectedApproval.site_name ||
                          "-"}
                      </td>
                    </tr>

                    <tr>
                      <th>Tender</th>
                      <td>
                        {selectedApproval.tender_title ||
                          selectedApproval.tender_name ||
                          "-"}
                      </td>
                    </tr>

                    <tr>
                      <th>Reason</th>
                      <td>
                        {selectedApproval.reason ||
                          "-"}
                      </td>
                    </tr>

                    <tr>
                      <th>
                        Progress Notes
                      </th>
                      <td>
                        {selectedApproval.notes ||
                          "-"}
                      </td>
                    </tr>

                    <tr>
                      <th>
                        Admin Comment
                      </th>
                      <td>
                        {selectedApproval.admin_comment ||
                          "-"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <h3>Progress Photo</h3>

              {selectedApproval.photo_url ? (
                <>
                  <img
                    src={
                      selectedApproval.photo_url
                    }
                    alt="Daily update evidence"
                    style={{
                      width: "100%",
                      maxHeight: 420,
                      objectFit:
                        "cover",
                      borderRadius: 12,
                    }}
                  />

                  <div className="form-actions">
                    <a
                      href={
                        selectedApproval.photo_url
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Full Photo
                    </a>
                  </div>
                </>
              ) : (
                <p className="muted-text">
                  No progress photo was
                  submitted.
                </p>
              )}
            </div>
          </div>

          {normaliseStatus(
            selectedApproval.status
          ) !== "pending" && (
            <section className="panel">
              <div className="section-title-row">
                <div>
                  <h3>
                    Approval History
                  </h3>

                  <p className="muted-text">
                    Final decision and
                    administrator
                    comment.
                  </p>
                </div>

                <span
                  className={getStatusClass(
                    selectedApproval.status
                  )}
                >
                  {normaliseStatus(
                    selectedApproval.status
                  )}
                </span>
              </div>

              <p>
                {selectedApproval.admin_comment ||
                  "No administrator comment was recorded."}
              </p>
            </section>
          )}
        </section>
      )}

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              Approval Requests Register
            </h2>

            <p className="muted-text">
              {filteredApprovals.length}{" "}
              matching approval request
              {filteredApprovals.length ===
              1
                ? ""
                : "s"}
              .
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th>Site</th>
                <th>Tender</th>
                <th>Date</th>
                <th>Notes</th>
                <th>Photo</th>
                <th>Reason</th>
                <th>Status</th>
                <th>
                  Admin Comment
                </th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredApprovals.map(
                (approval) => (
                  <tr key={approval.id}>
                    <td>
                      <button
                        type="button"
                        className="table-link-button"
                        onClick={() =>
                          setSelectedApproval(
                            approval
                          )
                        }
                        disabled={
                          processing
                        }
                      >
                        {approval.worker_name ||
                          "-"}
                      </button>
                    </td>

                    <td>
                      {approval.site_name ||
                        "-"}
                    </td>

                    <td>
                      {approval.tender_title ||
                        approval.tender_name ||
                        "-"}
                    </td>

                    <td>
                      {dateOnly(
                        approval.log_date ||
                          approval.created_at
                      )}
                    </td>

                    <td>
                      {approval.notes ||
                        "-"}
                    </td>

                    <td>
                      {approval.photo_url ? (
                        <button
                          type="button"
                          className="table-link-button"
                          onClick={() =>
                            setSelectedApproval(
                              approval
                            )
                          }
                          disabled={
                            processing
                          }
                        >
                          <img
                            src={
                              approval.photo_url
                            }
                            alt="Approval"
                            className="worker-photo-thumb"
                          />
                        </button>
                      ) : (
                        "No photo"
                      )}
                    </td>

                    <td>
                      {approval.reason ||
                        "-"}
                    </td>

                    <td>
                      <span
                        className={getStatusClass(
                          approval.status
                        )}
                      >
                        {normaliseStatus(
                          approval.status
                        )}
                      </span>
                    </td>

                    <td>
                      {approval.admin_comment ||
                        "-"}
                    </td>

                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() =>
                            setSelectedApproval(
                              approval
                            )
                          }
                          disabled={
                            processing
                          }
                        >
                          Preview
                        </button>

                        {normaliseStatus(
                          approval.status
                        ) ===
                          "pending" && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                openApproveModal(
                                  approval
                                )
                              }
                              disabled={
                                processing
                              }
                            >
                              Approve
                            </button>

                            <button
                              type="button"
                              className="delete-btn"
                              onClick={() =>
                                openRejectModal(
                                  approval
                                )
                              }
                              disabled={
                                processing
                              }
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              )}

              {filteredApprovals.length ===
                0 && (
                <tr>
                  <td
                    colSpan="10"
                    className="empty-table-message"
                  >
                    No approval requests
                    found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ApprovalActionModal
        open={Boolean(
          approveTarget
        )}
        title="Approve Daily Update"
        actionLabel={
          processing
            ? "Processing..."
            : "Approve"
        }
        actionType={confirmCode}
        comment={adminComment}
        setComment={
          setAdminComment
        }
        onCancel={closeModal}
        onConfirm={{
          setCode:
            setConfirmCode,
          submit:
            handleApprove,
        }}
      />

      <ApprovalActionModal
        open={Boolean(
          rejectTarget
        )}
        title="Reject Daily Update"
        actionLabel={
          processing
            ? "Processing..."
            : "Reject"
        }
        actionType={confirmCode}
        comment={adminComment}
        setComment={
          setAdminComment
        }
        onCancel={closeModal}
        onConfirm={{
          setCode:
            setConfirmCode,
          submit:
            handleReject,
        }}
      />
    </>
  );
}

export default DailyUpdateApprovalsPage;