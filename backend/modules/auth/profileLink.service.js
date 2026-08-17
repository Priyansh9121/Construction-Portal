/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The link between a login and the profile row that gives it meaning.
|
| Some roles are only an identity — an admin or a manager IS their `users`
| row and needs nothing else. Two roles are not: a `worker` and a
| `subcontractor` each name a person who already exists in a register, and
| every surface downstream of the role reads that register rather than the
| users table.
|
|   - `workerPortal.controller.js` refuses an unlinked login at five call
|     sites: "No worker profile is linked to this login user."
|   - `subcontractorPortal.controller.js` does the same at five of its own.
|   - The tender worker picker is `GET /workers`, which is
|     `SELECT t.* FROM workers t WHERE t.company_id = $1`. No join to users.
|
| So a `users` row with role 'worker' and no `workers` row is not a partial
| account. It is a login that can authenticate and then reach nothing, and
| that cannot be assigned to a tender because the picker reads a table it is
| not in. That was BUG-002.
|
| WHY THIS MODULE EXISTS AT ALL
|
| `workers.user_id` and `subcontractors.user_id` have always existed, and
| both are declared writable by their CRUD controllers. The API has always
| accepted the link. Nothing in the product ever set it — grepping `user_id`
| across `frontend/src` finds nothing in either register, and the only writer
| in the repository was `scripts/createLocalPortalFixtures.js`, a local dev
| script. Every correctly linked row in the database was made by hand.
|
| The bug was never that one creation path forgot a step. The linking
| operation had not been built. This is it.
|
| THE DIRECTION IS DELIBERATELY ASYMMETRIC
|
| A role-bearing user MUST resolve a profile. A profile need NEVER have a
| login. `worker.controller.js` says so of its own column: "Most workers have
| none — they exist as payroll records only." A labourer on the payroll who
| never signs in is the normal case and stays valid; this module does not
| touch that direction and must not be made to.
|
| Exports:
|   resolveProfilePlan  — read-only. Validates and returns a plan, or null.
|   applyProfilePlan    — the write. Consumes a plan, returns the profile id.
|   PROFILE_FOR_ROLE    — the role -> table map, for callers that need to
|                         ask whether a role has a profile concept at all.
|
| Used by:
|   ./auth.service.js  — createCompanyUser, inside its existing transaction
|   ./auth.controller.js — createUser, to shape the request body
|
| Depends on:
|   ../../config/constants — USER_ROLES
|   ../../utils/requestContext — cleanText, toPositiveInteger
|
| Database tables touched:
|   workers, subcontractors — SELECT ... FOR UPDATE, UPDATE, INSERT
|
| Note:
|   Every statement here takes a `client`, never the pool. That is the whole
|   point: this work belongs to the caller's transaction, so a failure rolls
|   the user back with it. Passing a pool would recreate the bug in a new
|   shape — a profile written that no rollback can remove.
|
*/

const {
  USER_ROLES,
} = require("../../config/constants");

const {
  cleanText,
  toPositiveInteger,
} = require("../../utils/requestContext");

/*
 * The role -> profile table map.
 *
 * This object is the reason there is one implementation rather than two.
 * Subcontractor support is a KEY HERE, not a branch anywhere below: nothing
 * in this file names a table literally, and no function tests which role it
 * was given. If a future change wants an `if (role === "subcontractor")`,
 * the right move is to add a property to this map instead.
 *
 * A role absent from the map has no profile concept. `admin` and `manager`
 * are unaffected by omission rather than by an exception, which is why
 * adding a fifth role that needs no profile requires no code change.
 *
 * `createColumns` is the subset a newly created profile is allowed to set.
 * It is deliberately small — the register's own screens own the rest. The
 * point of create-new is to get a linkable row into existence, not to make
 * User Management a second payroll form.
 */
const PROFILE_FOR_ROLE = Object.freeze({
  [USER_ROLES.WORKER]: Object.freeze({
    table: "workers",
    label: "worker",
    /*
     * `salary` is absent on purpose. It used to be required, which would
     * have forced an admin issuing a login to invent payroll data. That
     * requirement was dropped in the same change that added this module —
     * see worker.validation.js — so a profile created here starts with no
     * salary and the payroll screen fills it in later.
     */
    createColumns: ["full_name", "phone", "role", "status"],
    defaults: Object.freeze({
      role: "Worker",
      status: "active",
    }),
  }),
  [USER_ROLES.SUBCONTRACTOR]: Object.freeze({
    table: "subcontractors",
    label: "subcontractor",
    createColumns: ["full_name", "phone", "business_name", "status"],
    defaults: Object.freeze({
      status: "active",
    }),
  }),
});

/*
 * Errors carry statusCode and publicMessage, matching the convention the
 * rest of auth.service.js uses so the controller's existing error handling
 * needs no special case.
 */
const fail = (statusCode, message) => {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.publicMessage = message;

  throw error;
};

/**
 * Decides what profile work a new user needs, without doing any of it.
 *
 * Purpose:
 * The read-only half. Everything that can be known to be wrong is found
 * here, BEFORE the caller hashes a password or writes a row.
 *
 * That ordering is not incidental. createCompanyUser already checks the
 * company exists first, and says why in its own comment: "so the failure
 * names the real problem rather than surfacing as a foreign-key violation
 * after the password has been hashed." This function extends that rule to
 * the profile. The write it plans cannot happen yet — it needs a user id
 * that does not exist until two steps later — which is precisely why
 * resolve and apply are two functions and not one.
 *
 * Parameters:
 * client    - the caller's transaction client. Required.
 * companyId - the company from the SESSION, never the request body.
 * role      - the normalised users.role
 * profile   - the request's profile instruction:
 *               { mode: "link",   id }       link an existing register row
 *               { mode: "create", ...fields } create a minimal new one
 *
 * Returns:
 * null when the role needs no profile, otherwise a plan object that
 * applyProfilePlan consumes. Never partially applied.
 *
 * Throws:
 * 400 for a missing or malformed instruction, 404 when the row does not
 * exist in this company, 409 when it is already linked.
 *
 * Side effects:
 * One SELECT ... FOR UPDATE in link mode, which holds the target row for
 * the rest of the caller's transaction. Nothing is written.
 *
 * Security:
 * The company scope comes from the caller's session and is applied to the
 * lookup, so an admin cannot link a user to another tenant's register row.
 * A row in another company is reported as 404, not 403 — the same shape
 * scopedCrud uses, so the response cannot be used to probe for the
 * existence of another tenant's records.
 */
const resolveProfilePlan = async ({
  client,
  companyId,
  role,
  profile,
}) => {
  const config = PROFILE_FOR_ROLE[role];

  /*
   * The role has no profile concept. Not an error — this is admin and
   * manager taking the path they always took.
   */
  if (!config) {
    return null;
  }

  if (!profile || typeof profile !== "object") {
    return fail(
      400,
      `Creating a ${config.label} login needs a ${config.label} record. Link an existing one, or create a new one.`
    );
  }

  if (profile.mode === "link") {
    const profileId = toPositiveInteger(profile.id);

    if (!profileId) {
      return fail(
        400,
        `Select which ${config.label} record this login belongs to.`
      );
    }

    /*
     * FOR UPDATE, not a plain SELECT. It holds the row until the caller's
     * transaction ends, so a second admin linking the same record at the
     * same moment blocks here rather than both passing the user_id IS NULL
     * check and one silently overwriting the other.
     */
    const existing = await client.query(
      `
      SELECT id, user_id
      FROM public.${config.table}
      WHERE id = $1
        AND company_id = $2
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
      FOR UPDATE
      `,
      [profileId, companyId]
    );

    if (existing.rows.length === 0) {
      return fail(
        404,
        `That ${config.label} record was not found.`
      );
    }

    if (existing.rows[0].user_id !== null) {
      return fail(
        409,
        `That ${config.label} already has a login. Each record can be linked to one login only.`
      );
    }

    return {
      mode: "link",
      table: config.table,
      label: config.label,
      profileId,
      companyId,
    };
  }

  if (profile.mode === "create") {
    const values = {
      ...config.defaults,
    };

    for (const column of config.createColumns) {
      const supplied = cleanText(profile[column]);

      if (supplied) {
        values[column] = supplied;
      }
    }

    /*
     * full_name is the one field with no sensible default — it is what
     * every picker renders. subcontractors.full_name is NOT NULL at the
     * database level too, so this check is also what keeps that constraint
     * from being the thing that reports the problem.
     */
    if (!values.full_name) {
      return fail(
        400,
        `A name is required to create a new ${config.label} record.`
      );
    }

    return {
      mode: "create",
      table: config.table,
      label: config.label,
      companyId,
      values,
    };
  }

  return fail(
    400,
    `Unrecognised profile instruction. Expected "link" or "create".`
  );
};

/**
 * Carries out the plan resolveProfilePlan produced.
 *
 * Purpose:
 * The write half, run once the user id exists.
 *
 * Parameters:
 * client - the SAME transaction client the plan was resolved on
 * plan   - the return of resolveProfilePlan; null is a no-op
 * userId - the id of the users row just created
 *
 * Returns:
 * The profile row's id, or null when there was no plan.
 *
 * Throws:
 * 409 when the link UPDATE matches no row.
 *
 * Side effects:
 * One UPDATE or one INSERT, inside the caller's transaction.
 *
 * Business rules:
 * The link UPDATE repeats every precondition resolveProfilePlan already
 * checked, and then asserts it matched exactly one row. That is not
 * redundant. FOR UPDATE serialises concurrent linkers, but the WHERE clause
 * is what makes a lost race a rolled-back 409 instead of a user created
 * with no profile — the exact state this whole module exists to prevent.
 * The partial unique indexes (ux_workers_user_id, and ux_subcontractors_user_id
 * added by migration 007) are the third layer, the one that still holds if a
 * future caller forgets to check rowCount.
 */
const applyProfilePlan = async ({
  client,
  plan,
  userId,
}) => {
  if (!plan) {
    return null;
  }

  if (plan.mode === "link") {
    const linked = await client.query(
      `
      UPDATE public.${plan.table}
      SET user_id = $1,
          updated_at = now()
      WHERE id = $2
        AND company_id = $3
        AND user_id IS NULL
        AND COALESCE(is_deleted, false) = false
      RETURNING id
      `,
      [userId, plan.profileId, plan.companyId]
    );

    if (linked.rowCount !== 1) {
      return fail(
        409,
        `That ${plan.label} could not be linked — it may have just been linked to another login. Nothing was created.`
      );
    }

    return linked.rows[0].id;
  }

  const columns = Object.keys(plan.values);

  const placeholders = columns.map(
    (_, index) => `$${index + 3}`
  );

  const created = await client.query(
    `
    INSERT INTO public.${plan.table}
      (company_id, user_id, ${columns.join(", ")})
    VALUES
      ($1, $2, ${placeholders.join(", ")})
    RETURNING id
    `,
    [
      plan.companyId,
      userId,
      ...columns.map((column) => plan.values[column]),
    ]
  );

  return created.rows[0].id;
};

module.exports = {
  PROFILE_FOR_ROLE,
  resolveProfilePlan,
  applyProfilePlan,
};
