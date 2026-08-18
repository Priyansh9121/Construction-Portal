/**
 * File purpose:
 * Issue a worker-portal login for a worker who already exists in the payroll
 * register — the inverse of what User Management does.
 *
 * Connected to:
 * - WorkersPage.jsx, which renders it from a row action.
 * - services/userService.js createUser -> POST /api/auth/users
 *
 * Important notes:
 * - THIS ADDS NO BACKEND. `POST /api/auth/users` already accepts
 *   `profile: { mode: "link", id }` and forwards it untouched to
 *   createCompanyUser, which runs resolveProfilePlan and applyProfilePlan
 *   inside one transaction. Everything that makes the link safe already lives
 *   there: SELECT ... FOR UPDATE, a `rowCount === 1` guard, a company-scoped
 *   lookup so an admin cannot link across tenants, and a 409 when the record
 *   already has a login. Reimplementing any of that here would recreate
 *   BUG-002 in a new place — the whole point of the shared primitive is that
 *   there is exactly one implementation.
 * - The direction stays OPTIONAL. A payroll worker with no login is a normal,
 *   supported state; this is an action someone chooses, never a step in
 *   creating a worker. The create form is deliberately untouched.
 * - Admin only, matching the endpoint. `POST /api/auth/users` is gated on
 *   requireAdministrator while /api/workers allows managers too, so a manager
 *   can create the payroll record but not issue its credentials. The caller
 *   hides the control; the backend 403 remains the real guard.
 *
 * - THE EMAIL IS WRITTEN TO `users.email` ONLY, AND `workers.email` IS LEFT
 *   ALONE ON PURPOSE. This is not an oversight, and it was reversed from the
 *   opposite decision after measuring, so please do not "fix" it back.
 *
 *   `workers.email` exists (002_baseline_supabase.sql) and is in the workers
 *   allow-list, so writing it is easy — that is the trap. `PUT /api/workers/:id`
 *   builds its UPDATE with COALESCE (utils/scopedCrud.js), which means an
 *   omitted field keeps its stored value. A value written there could therefore
 *   be SET but never CLEARED through the API. Duplicating the login's address
 *   into a column with no way back is worse than not having it: it is a second
 *   source of truth, unsynchronised, and permanently wrong the first time
 *   somebody changes their email.
 *
 *   Nothing writes `workers.email` anywhere in the codebase today. Keep it so
 *   until the update path can clear a column.
 */
import { useState } from "react";
import toast from "react-hot-toast";

import { createUser } from "../../services/userService";

/* Deliberately permissive. The server is the authority on what it will accept;
 * this only catches the obvious typo before two writes are attempted. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function InviteLoginModal({ worker, onClose, onInvited }) {
  const [email, setEmail] = useState(worker.email || "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const emailLooksValid = EMAIL_SHAPE.test(email.trim());
  const canSubmit = emailLooksValid && password.length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);

    try {
      /*
       * ONE REQUEST, AND THEREFORE ONE TRANSACTION.
       *
       * The worker row already exists and is not rewritten here, so there is
       * no second write to keep in step. The server does the whole job inside
       * a single withTransaction: the users row, the company_users membership,
       * and the UPDATE that sets workers.user_id — all commit or none do.
       *
       * That is the entire reason this is a row action rather than a step in
       * creating a worker. Creating both at once would need two requests
       * against a create path that has no transaction of its own, and a
       * failure between them is precisely how an unlinked login gets made.
       */
      await createUser({
        full_name: worker.full_name,
        email: email.trim(),
        password,
        role: "worker",
        /*
         * The link mode. `id` is the REGISTER row, not a user — the server
         * resolves it inside its own transaction and refuses if it is already
         * linked or belongs to another company.
         */
        profile: { mode: "link", id: worker.id },
      });

      toast.success(`Portal login created for ${worker.full_name}.`);
      onInvited?.();
      onClose();
    } catch (error) {
      /* The server's message is the useful one — "That Worker already has a
       * login", "Email already registered", a password-strength refusal. Do
       * not flatten them into a generic failure. */
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Could not create the portal login.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h3>Invite a portal login</h3>

        <p>
          Creating a worker-portal login for{" "}
          <strong>{worker.full_name}</strong>.
        </p>

        <label htmlFor="invite-email">Email</label>
        <input
          id="invite-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="worker@example.com"
          autoComplete="off"
          autoFocus
          aria-invalid={email.length > 0 && !emailLooksValid}
        />

        <label htmlFor="invite-password">Temporary password</label>
        <input
          id="invite-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Set a temporary password"
          autoComplete="new-password"
        />

        {/*
          * Said plainly, because it is true and because the alternative was
          * measured and rejected: SMTP is unset locally and optional in
          * production (render.yaml carries the keys as `sync: false`,
          * DEPLOYMENT.md lists them as not required), so an emailed invite
          * link would silently go nowhere in either environment.
          */}
        <p className="form-hint">
          No email is sent. Give this password to the worker directly and ask
          them to change it after signing in.
        </p>

        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            title={
              canSubmit
                ? undefined
                : "Enter a valid email and a temporary password."
            }
          >
            {busy ? "Creating..." : "Create login"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InviteLoginModal;
