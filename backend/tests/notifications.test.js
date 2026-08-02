/* describe / it / expect / beforeAll / afterAll come from Vitest globals
   (globals: true in vitest.config.mjs), because a CommonJS file cannot
   require("vitest") directly. */

const supertest = require("supertest");

const app = require("../server");

const {
  createCompany,
  createMember,
  cleanup,
  daysAgo,
  pool,
} = require("./helpers/testDb");

/*
|--------------------------------------------------------------------------
| Notifications
|--------------------------------------------------------------------------
|
| The office is told when a supervisor asks to unlock a backdated date, and
| again when the request is decided.
|
| That fan-out was silently broken: notifyRole selected on
| cu.company_role, a column that does not exist — every other query in the
| codebase aliases it as `cu.role AS company_role`. The failure was
| swallowed by the catch that exists so a notification cannot fail the
| request it accompanies, so no notification was ever written and nothing
| said so.
|
| The frontend made the same absence invisible from the other side: the
| bell derived its list on the client from whatever rows the page happened
| to be holding, so an empty notifications table looked normal.
|
*/

const request = supertest(app);

let office;
let supervisor;

beforeAll(async () => {
  office = await createCompany(request, "notify");

  supervisor = await createMember(request, office, {
    label: "supervisor",
    role: "manager",
  });
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

/**
 * Notifications are written without being awaited, so poll briefly rather
 * than assuming the row has landed by the time the response returns.
 */
const waitForNotifications = async (actor, atLeast = 1) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const res = await actor.auth(request.get("/api/notifications"));

    if ((res.body.notifications || []).length >= atLeast) {
      return res.body;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  const res = await actor.auth(request.get("/api/notifications"));

  return res.body;
};

describe("access requests notify the office", () => {
  it("writes a notification the admin can read", async () => {
    const created = await supervisor
      .auth(request.post("/api/site-operations/access-requests"))
      .send({
        module: "material",
        target_date: daysAgo(20),
        reason: "The bill reached the office late.",
      });

    expect(created.status).toBe(201);

    const body = await waitForNotifications(office);

    expect(body.notifications.length).toBeGreaterThan(0);
    expect(body.unread_count).toBeGreaterThan(0);

    const notification = body.notifications[0];

    expect(notification.title).toMatch(/access/i);
    expect(notification.notification_type).toBe("access_request");
    expect(notification.link).toBe("/daily-update-approvals");
    expect(notification.is_read).toBe(false);
  });

  it("marks one as read", async () => {
    const before = await waitForNotifications(office);
    const target = before.notifications.find((item) => !item.is_read);

    const res = await office.auth(
      request.post(`/api/notifications/${target.id}/read`)
    );

    expect(res.status).toBe(200);

    const after = await office.auth(request.get("/api/notifications"));

    expect(after.body.unread_count).toBe(before.unread_count - 1);
  });

  it("marks all as read", async () => {
    await supervisor
      .auth(request.post("/api/site-operations/access-requests"))
      .send({
        module: "labour",
        target_date: daysAgo(15),
        reason: "The muster roll was still on site.",
      });

    await waitForNotifications(office, 2);

    const res = await office.auth(
      request.post("/api/notifications/read-all")
    );

    expect(res.status).toBe(200);

    const after = await office.auth(request.get("/api/notifications"));

    expect(after.body.unread_count).toBe(0);
  });
});

describe("a notification queue is private to its owner", () => {
  it("gives a labourer none of the office's notifications", async () => {
    // The fan-out targets admins and managers, so a worker in the same
    // company has an empty queue even though rows exist for that company.
    const worker = await createMember(request, office, {
      label: "labourer",
      role: "worker",
    });

    const res = await worker.auth(request.get("/api/notifications"));

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(0);
    expect(res.body.unread_count).toBe(0);
  });

  it("reaches every office member, not just the admin", async () => {
    // supervisor is a manager, so the fan-out includes them.
    const res = await supervisor.auth(request.get("/api/notifications"));

    expect(res.status).toBe(200);
    expect(res.body.notifications.length).toBeGreaterThan(0);
  });

  it("refuses to mark another member's notification read", async () => {
    const mine = await office.auth(request.get("/api/notifications"));
    const theirs = await supervisor.auth(request.get("/api/notifications"));

    const otherId = theirs.body.notifications.find(
      (item) =>
        !mine.body.notifications.some((own) => own.id === item.id)
    )?.id;

    // Every office member has their own row for the same event, so the
    // admin should not be able to touch the manager's copy.
    expect(otherId).toBeDefined();

    const res = await office.auth(
      request.post(`/api/notifications/${otherId}/read`)
    );

    expect(res.status).toBe(404);
  });
});

describe("the audit trail is office-only", () => {
  it("lets an admin read it", async () => {
    const res = await office.auth(request.get("/api/activity"));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.activity)).toBe(true);
  });

  it("refuses a worker", async () => {
    const worker = await createMember(request, office, {
      label: "audit-labourer",
      role: "worker",
    });

    const res = await worker.auth(request.get("/api/activity"));

    expect(res.status).toBe(403);
  });
});
