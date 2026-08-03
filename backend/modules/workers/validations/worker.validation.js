/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| Request-body validation for creating and updating a worker.
|
| Two rules the generic CRUD factory cannot express on its own: that salary
| must be a positive number, and that the whole set of core fields is
| present with one combined message rather than four separate ones.
|
| Responsibilities:
|   - Reject a worker payload missing any core field
|   - Reject a non-positive salary
|
| Exports:
|   validateWorker (the function itself, not an object — callers write
|   `require("./validations/worker.validation")`)
|
| Used by:
|   ../worker.routes.js, on POST / and PUT /:id
|
| Depends on:
|   nothing
|
| Note:
|   This runs BEFORE the controller, which is the scopedCrud-generated
|   handler. The factory performs its own required-field check as well, so
|   the two overlap. They are not identical, though — see the notes on the
|   function below, and F-11 in docs/repository-reference/findings.md.
|
*/

/**
 * Validates a worker create or update body.
 *
 * Purpose:
 * Guards the two things the factory's declarative config cannot: a numeric
 * lower bound, and a single readable message naming every missing field.
 *
 * Parameters:
 * req  - Express request; reads full_name, phone, salary, role, status
 * res  - Express response
 * next - passes control to the controller when the body is acceptable
 *
 * Returns:
 * Nothing. Either sends a 400 or calls next().
 *
 * Side effects:
 * May write the response. Does not modify req.body — the values are read
 * for checking only, and the controller re-reads and coerces them.
 *
 * Business rules:
 * - full_name, phone, salary, role and status must all be present and
 *   truthy.
 * - Salary must be greater than zero.
 *
 * Notes:
 * The truthiness test means salary: 0 fails as "missing" rather than
 * reaching the positivity check — the same message either way, so the
 * outcome is right even though the reasoning differs.
 *
 * `status` is required here but has a default of "active" in the
 * controller's config. Because this middleware runs first, that default is
 * unreachable through the API: a create without a status is rejected before
 * the factory could supply one. See F-11.
 *
 * Applying the same rules to PUT as to POST makes updates a full replace of
 * the core fields rather than a patch — a caller changing only a phone
 * number must still send name, salary, role and status.
 */
function validateWorker(req, res, next) {
    const {
      full_name,
      phone,
      salary,
      role,
      status,
    } = req.body;
  
    if (!full_name || !phone || !salary || !role || !status) {
      return res.status(400).json({
        success: false,
        message: "Worker name, phone, salary, role and status are required",
      });
    }
  
    /*
     * The rule the factory's config cannot state. A negative or zero salary
     * would be accepted by a "number" column and would then flow into the
     * worker-money calculations as a nonsense figure.
     *
     * Number("abc") is NaN, and every comparison with NaN is false — so a
     * non-numeric salary passes this check and reaches the controller,
     * where coerce() turns it into 0. Worth knowing; not changed here.
     */
    if (Number(salary) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Salary must be greater than 0",
      });
    }
  
    next();
  }
  
  module.exports = validateWorker;