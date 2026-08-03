/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The write side of notifications. Other modules call these helpers when
| something happens that a person needs to know about.
|
| Responsibilities:
|   - Define the notification type vocabulary
|   - Insert notification rows for one or many recipients
|   - Never let a failed notification break the action that caused it
|
| Exports:
|   TYPES  the notification type vocabulary
|   plus the per-event dispatch helpers — see module.exports below
|
| Used by:
|   modules/siteOperations/accessRequest.controller.js — a request waiting
|   modules/dailyUpdateApprovals/  — an approval waiting, and its result
|   modules/workerMoney/           — allocation and expense outcomes
|
| Depends on:
|   database/pool.js
|
| Database tables touched:
|   notifications  INSERT only. Reading is notification.controller.js.
|
| Frontend surface:
|   the rows written here are what NotificationCenter.jsx displays, via
|   notificationService.js.
|
| Error handling:
|   Like utils/activityLog.js, failures are swallowed and logged. A missed
|   notification is bad; failing an approval because the notification
|   insert failed is worse.
|
*/

const pool = require("../../database/pool");

/*
|--------------------------------------------------------------------------
| Notification dispatch
|--------------------------------------------------------------------------
|
| Server-side helpers other modules call when something happens that a
| person needs to know about — an approval waiting, an access request
| granted, an allocation approved.
|
| Like the activity log, these never throw into the caller: a failed
| notification must not fail the action that triggered it.
|
*/

const TYPES = Object.freeze({
  APPROVAL_PENDING:
    "approval_pending",
  APPROVAL_RESULT: "approval_result",
  ACCESS_REQUEST: "access_request",
  ACCESS_GRANTED: "access_granted",
  PAYMENT: "payment",
  SYSTEM: "system",
});

/**
 * Sends one notification to one user.
 */
const notify = ({
  companyId,
  userId,
  title,
  message,
  type = TYPES.SYSTEM,
  link = null,
  metadata = {},
}) => {
  if (!companyId || !userId) {
    return Promise.resolve();
  }

  return pool
    .query(
      `
      INSERT INTO notifications
        (company_id, user_id, title, message,
         notification_type, link, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        companyId,
        userId,
        title,
        message,
        type,
        link,
        JSON.stringify(metadata),
      ]
    )
    .catch((error) => {
      console.error(
        "[notifications] send failed:",
        error.message
      );
    });
};

/**
 * Sends the same notification to everyone holding a given role.
 *
 * Used for "something needs approval" messages, which go to the office
 * rather than to one named person.
 */
const notifyRole = async ({
  companyId,
  roles = ["admin", "manager"],
  title,
  message,
  type = TYPES.SYSTEM,
  link = null,
  metadata = {},
}) => {
  if (!companyId) return;

  try {
    const recipients =
      await pool.query(
        `
        SELECT u.id
        FROM users u
        INNER JOIN company_users cu ON cu.user_id = u.id
        WHERE cu.company_id = $1
          AND u.status = 'active'
          AND (u.role = ANY($2) OR cu.role = ANY($2))
        `,
        [companyId, roles]
      );

    await Promise.all(
      recipients.rows.map((row) =>
        notify({
          companyId,
          userId: row.id,
          title,
          message,
          type,
          link,
          metadata,
        })
      )
    );
  } catch (error) {
    console.error(
      "[notifications] role fan-out failed:",
      error.message
    );
  }
};

module.exports = {
  TYPES,
  notify,
  notifyRole,
};
