/*
|--------------------------------------------------------------------------
| Request-scoped tenant context
|--------------------------------------------------------------------------
|
| Migration 003's policies compare every row against the app.company_id
| session variable:
|
|     USING (company_id = public.current_company_id())
|
| Something has to set that variable, on the same connection, for the
| duration of the statement. The obvious place is each call site — but there
| are 139 pool.query() calls and 11 withTransaction() blocks in this
| codebase, and a helper that every one of them has to remember to use is a
| helper that will eventually be forgotten. That is exactly how the API ended
| up connecting as construction_app with no context at all: RLS failed closed,
| reads quietly returned nothing and writes raised 42501.
|
| So the company travels out-of-band instead. authMiddleware puts it here
| once, and database/pool.js reads it back when it runs a query. Nothing in
| between has to know.
|
| WHY AsyncLocalStorage
|   The value has to survive every await between the middleware and the
|   query, without being threaded through function signatures. A module-level
|   variable cannot do this: Node interleaves concurrent requests, so request
|   B would overwrite request A's company mid-await and A would finish its
|   work against B's tenant. AsyncLocalStorage keeps a separate value per
|   asynchronous call chain, which is precisely the lifetime of one request.
|
| WHAT THIS IS NOT
|   This is not the authorisation boundary. Controllers still read
|   req.user.company_id and still filter their queries — that layer is what
|   tests/tenantIsolation.test.js checks, and it works whether or not RLS is
|   switched on. This file is the second layer: it makes a query that forgot
|   its WHERE clause return zero rows instead of every tenant's.
|
*/

const { AsyncLocalStorage } = require("node:async_hooks");

/*
 * Holds { companyId } for the lifetime of one request.
 *
 * Empty outside a request — startup checks, scripts, migrations and tests
 * that call the pool directly all run with no context, which callers must
 * treat as "no tenant scoping", not as "company zero".
 */
const tenantStorage =
  new AsyncLocalStorage();

/**
 * Runs a function with a company bound to the current async call chain.
 *
 * Parameters:
 * companyId - the authenticated user's company. Anything that is not a
 *             positive integer is ignored and the callback runs with no
 *             context, so a malformed value fails closed under RLS rather
 *             than silently scoping to something unintended.
 * callback  - run immediately, inside the context
 *
 * Returns:
 * Whatever the callback returns.
 *
 * Usage:
 *   runWithTenant(req.user.company_id, next);
 */
const runWithTenant = (
  companyId,
  callback
) => {
  const parsed = Number(companyId);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return callback();
  }

  return tenantStorage.run(
    { companyId: parsed },
    callback
  );
};

/**
 * The company bound to the current async call chain, or null.
 *
 * Returns null outside a request. Callers must treat null as "do not scope"
 * rather than substituting a default — under RLS a NULL context matches no
 * rows, which is the safe direction.
 */
const getTenantCompanyId = () => {
  const store =
    tenantStorage.getStore();

  return store
    ? store.companyId
    : null;
};

module.exports = {
  runWithTenant,
  getTenantCompanyId,
};
