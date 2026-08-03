/**
 * File purpose:
 * Confirmation dialog for a destructive action, requiring the user to type
 * a confirmation value.
 *
 * Props:
 * - isOpen, the record label, the expected confirmation text, onConfirm,
 * - onCancel
 *
 * State and hooks:
 * - Local typed-confirmation text
 *
 * Rendered by:
 * - The register pages, before deleting a tender, worker, site or payment
 *
 * Important notes:
 * - Typing the name rather than clicking once is deliberate friction. Most
 * - deletes here are soft and recoverable, but a few cascade — deleting a
 * - tender takes its sites with it — and several cannot be undone from the
 * - UI at all.
 * - The backend applies its own guards regardless: a site with activity
 * - against it answers 409, and a tender with people assigned does too.
 */

import { useState } from "react";

/*
|--------------------------------------------------------------------------
| Delete verification
|--------------------------------------------------------------------------
|
| The last step before a destructive action. Every page that deletes
| something routes through here, so the challenge has to actually gate the
| button — it previously computed whether the answer was correct and then
| ignored the result, leaving Delete enabled whatever the user typed.
|
*/

const SECURITY_QUESTION = {
  question: "Type the last 3 letters of DELETE",
  answer: "ETE",
};

function DeleteVerificationModal({
  open,
  itemName,
  onCancel,
  onConfirm,
  loading = false,
}) {
  const [answer, setAnswer] = useState("");

  /*
   * Clear the previous answer when the dialog reopens.
   *
   * Adjusting state during render is React's documented alternative to an
   * effect here: it happens before the browser paints, so the stale answer
   * from the last deletion is never briefly visible, and it avoids the
   * extra render an effect would cost.
   */
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    setAnswer("");
  }

  if (!open) {
    return null;
  }

  const isValid =
    answer.trim().toUpperCase() === SECURITY_QUESTION.answer;

  const confirm = () => {
    if (!isValid || loading) {
      return;
    }

    onConfirm();
  };

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
          onChange={(event) => setAnswer(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              confirm();
            }
          }}
          placeholder="Enter answer"
          autoComplete="off"
          autoFocus
          aria-invalid={answer.length > 0 && !isValid}
        />

        <div className="modal-actions">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            type="button"
            className="delete-btn"
            onClick={confirm}
            disabled={loading || !isValid}
            title={
              isValid
                ? undefined
                : "Answer the verification question to enable deletion."
            }
          >
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteVerificationModal;
