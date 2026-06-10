import { useEffect, useState } from "react";

const SECURITY_QUESTION = {
  question: "Type the last 3 letters of DELETE",
  answer: "ETE",
};

function DeleteVerificationModal({
  open,
  itemName,
  onCancel,
  onConfirm,
}) {
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    if (open) {
      setAnswer("");
    }
  }, [open]);

  if (!open) return null;

  const isValid =
    answer.trim().toUpperCase() === SECURITY_QUESTION.answer;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h3>Delete Verification</h3>

        <p>
          You are deleting: <strong>{itemName}</strong>
        </p>

        <p>{SECURITY_QUESTION.question}</p>

        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Enter answer"
          autoComplete="off"
        />

        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>

          <button
            type="button"
            className="delete-btn"
            disabled={!isValid}
            onClick={onConfirm}
          >
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteVerificationModal;