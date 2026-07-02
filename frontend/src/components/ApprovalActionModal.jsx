function ApprovalActionModal({
    open,
    title,
    actionLabel,
    actionType,
    comment,
    setComment,
    onCancel,
    onConfirm,
  }) {
    if (!open) return null;
  
    return (
      <div className="modal-backdrop">
        <div className="modal-card">
          <h2>{title}</h2>
  
          <p>
            Type <strong>ETE</strong> to confirm this action.
          </p>
  
          <textarea
            className="search-input"
            placeholder="Optional admin comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
  
          <input
            placeholder="Type ETE"
            value={actionType}
            onChange={(e) => onConfirm.setCode(e.target.value)}
          />
  
          <div className="modal-actions">
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
  
            <button
              type="button"
              className={actionLabel === "Reject" ? "delete-btn" : ""}
              onClick={onConfirm.submit}
              disabled={actionType !== "ETE"}
            >
              {actionLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  export default ApprovalActionModal;