import { useEffect, useState } from "react";

import {
  getDailyUpdateApprovals,
  approveDailyUpdate,
  rejectDailyUpdate,
} from "../services/dailyUpdateApprovalService";

import ApprovalActionModal from "../components/ApprovalActionModal";

function DailyUpdateApprovalsPage() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);

  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [adminComment, setAdminComment] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");

  const loadApprovals = async () => {
    setLoading(true);

    try {
      const data = await getDailyUpdateApprovals(statusFilter);
      setApprovals(data.approvals || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, [statusFilter]);

  const closeModal = () => {
    setApproveTarget(null);
    setRejectTarget(null);
    setAdminComment("");
    setConfirmCode("");
  };

  const handleApprove = async () => {
    if (!approveTarget) return;

    await approveDailyUpdate(approveTarget.id, adminComment);

    closeModal();
    loadApprovals();
  };

  const handleReject = async () => {
    if (!rejectTarget) return;

    await rejectDailyUpdate(rejectTarget.id, adminComment);

    closeModal();
    loadApprovals();
  };

  if (loading) {
    return <div className="panel">Loading approvals...</div>;
  }

  return (
    <>
      <section className="panel">
        <h2>Daily Update Approvals</h2>

        <div className="tabs">
          {["pending", "approved", "rejected", "all"].map((status) => (
            <button
              key={status}
              type="button"
              className={statusFilter === status ? "active-tab" : ""}
              onClick={() => setStatusFilter(status)}
            >
              {status.toUpperCase()}
            </button>
          ))}
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
                <th>Admin Comment</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {approvals.map((approval) => (
                <tr key={approval.id}>
                  <td>{approval.worker_name}</td>
                  <td>{approval.site_name}</td>
                  <td>{approval.tender_title}</td>
                  <td>{approval.log_date?.slice(0, 10)}</td>
                  <td>{approval.notes || "-"}</td>

                  <td>
                    {approval.photo_url ? (
                      <>
                        <a
                          href={approval.photo_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>

                        <img
                          src={approval.photo_url}
                          alt="Approval"
                          className="worker-photo-thumb"
                        />
                      </>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td>{approval.reason}</td>
                  <td>{approval.status}</td>
                  <td>{approval.admin_comment || "-"}</td>

                  <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {approval.status === "pending" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setAdminComment("");
                            setConfirmCode("");
                            setApproveTarget(approval);
                          }}
                        >
                          Approve
                        </button>

                        <button
                          type="button"
                          className="delete-btn"
                          onClick={() => {
                            setAdminComment("");
                            setConfirmCode("");
                            setRejectTarget(approval);
                          }}
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}

              {approvals.length === 0 && (
                <tr>
                  <td colSpan="10" className="empty-table-message">
                    No approvals found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ApprovalActionModal
        open={!!approveTarget}
        title="Approve Daily Update"
        actionLabel="Approve"
        actionType={confirmCode}
        comment={adminComment}
        setComment={setAdminComment}
        onCancel={closeModal}
        onConfirm={{
          setCode: setConfirmCode,
          submit: handleApprove,
        }}
      />

      <ApprovalActionModal
        open={!!rejectTarget}
        title="Reject Daily Update"
        actionLabel="Reject"
        actionType={confirmCode}
        comment={adminComment}
        setComment={setAdminComment}
        onCancel={closeModal}
        onConfirm={{
          setCode: setConfirmCode,
          submit: handleReject,
        }}
      />
    </>
  );
}

export default DailyUpdateApprovalsPage;