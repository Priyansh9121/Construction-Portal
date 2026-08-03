/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| Payload validation for the tenders module. Every request body that
| reaches tender.service.js has been through a function in this file
| first.
|
| Its job is narrow and worth stating precisely: this file decides whether
| a payload is well-FORMED, not whether it is permitted. It knows nothing
| about companies, ownership or roles. "Is this a valid tender status" is
| answered here; "is this the caller's client" is answered in the service
| by a database query.
|
| Layering:
|   tender.routes.js      URLs, roles, audit
|   tender.controller.js  HTTP
|   tender.service.js     business rules, calls these validators
|   tenderQueries.js      SQL
|   tenderValidation.js   payload shape and value rules      <- this file
|
| Responsibilities:
|   - Coerce loose JSON into the types the database columns expect
|   - Reject values outside the enumerations in config/constants.js
|   - Apply cross-field rules such as start_date <= due_date
|   - Return a clean, allow-listed object the service can pass to a query
|
| The allow-list property is the important one. Each validator builds a
| NEW object from named fields rather than passing the request body
| through, so a key the client invents — id, company_id, is_deleted,
| created_at — simply does not survive. That is what makes mass assignment
| impossible on this module's write paths.
|
| Exports:
|   validateCreateTender, validateUpdateTender, validateTenderFilters
|   validateTenderDocument, validateTenderMaterial, validateTenderBanking
|   validateTenderSubcontractor, validateTenderWorker
|   validateTenderFinanceRecord
|
| Used by:
|   ./tender.service.js — the only consumer
|
| Depends on:
|   config/constants.js      every allowed-value set
|   utils/requestContext.js  the shared coercion helpers
|
| Database tables touched:
|   none. This file issues no queries and has no database import.
|
| Error convention:
|   createValidationError attaches statusCode 400 and publicMessage, so
|   errorHandler.js can safely show the text to the user. Messages name the
|   field and say what was expected.
|
| Note on the enumerations:
|   The VALID_* sets are derived from config/constants.js with
|   Object.values rather than retyped, so adding a status there makes it
|   acceptable here automatically. The database stores these as plain
|   VARCHAR with no CHECK constraints, which means these sets are the only
|   thing preventing a typo being persisted.
|
*/

const {
    TENDER_STATUS,
    TENDER_TYPES,
    PRIORITY_LEVELS,
    RISK_LEVELS,
    SITE_STATUS,
    SITE_TYPES,
    ASSIGNMENT_STATUS,
    RECORD_STATUS,
    FINANCE_RECORD_TYPES,
    DEFAULTS,
  } = require("../../config/constants");
  
  const {
    cleanText,
    cleanLowerText,
    emptyToNull,
    toNumber,
    toPositiveInteger,
  } = require("../../utils/requestContext");
  
  /*
  |--------------------------------------------------------------------------
  | Allowed values
  |--------------------------------------------------------------------------
  */
  
  const VALID_TENDER_STATUSES = new Set(
    Object.values(TENDER_STATUS)
  );
  
  const VALID_TENDER_TYPES = new Set(
    Object.values(TENDER_TYPES)
  );
  
  const VALID_PRIORITIES = new Set(
    Object.values(PRIORITY_LEVELS)
  );
  
  const VALID_RISK_LEVELS = new Set(
    Object.values(RISK_LEVELS)
  );
  
  const VALID_SITE_STATUSES = new Set(
    Object.values(SITE_STATUS)
  );
  
  const VALID_SITE_TYPES = new Set(
    Object.values(SITE_TYPES)
  );
  
  const VALID_ASSIGNMENT_STATUSES = new Set(
    Object.values(ASSIGNMENT_STATUS)
  );
  
  const VALID_RECORD_STATUSES = new Set(
    Object.values(RECORD_STATUS)
  );
  
  const VALID_FINANCE_TYPES = new Set(
    Object.values(FINANCE_RECORD_TYPES)
  );
  
  /*
  |--------------------------------------------------------------------------
  | Shared helpers
  |--------------------------------------------------------------------------
  */
  
  const createValidationError = (
    message,
    statusCode = 400
  ) => {
    const error = new Error(message);
  
    error.statusCode = statusCode;
    error.publicMessage = message;
  
    return error;
  };
  
  /**
   * Uses the submitted value when the property exists.
   * Otherwise, it falls back to the existing database value.
   *
   * Purpose:
   * The mechanism that makes PUT a partial update. On create `existing` is
   * undefined and every field comes from the payload; on update the stored
   * row fills in whatever the client did not send.
   *
   * Parameters:
   * payload  - the request body
   * existing - the stored row, or undefined on create
   * key      - the field name
   *
   * Returns:
   * The submitted value if the key is PRESENT, otherwise the stored one.
   *
   * Notes:
   * hasOwnProperty rather than a truthiness or `!== undefined` check, and
   * the distinction is the whole point: it separates "the client did not
   * mention this field" from "the client explicitly sent null or empty".
   *
   * Only the second should clear a stored value. A `payload[key] ||
   * existing[key]` shortcut would make it impossible to blank a field —
   * every attempt would silently restore the old value.
   *
   * Called through Object.prototype rather than as payload.hasOwnProperty,
   * so a request body containing its own "hasOwnProperty" key cannot
   * subvert the check.
   */
  const getPayloadValue = (
    payload,
    existing,
    key
  ) =>
    Object.prototype.hasOwnProperty.call(
      payload,
      key
    )
      ? payload[key]
      : existing?.[key];
  
  /**
   * Validates an optional date and returns it in a storage-safe form.
   *
   * Purpose:
   * Tender dates — start, due, completion — are calendar dates, not
   * instants. A site starts "on the 3rd", not "at 00:00 UTC on the 3rd",
   * and the distinction matters because the two are not the same day for
   * most of the world.
   *
   * Parameters:
   * value - the raw field; may be a bare YYYY-MM-DD or a full timestamp
   * label - the field name for the error message, e.g. "Start date"
   *
   * Returns:
   * The date as a string, or null when absent. A date-only input is
   * returned UNCHANGED rather than converted.
   *
   * Throws:
   * 400 when the value is present but not a real date.
   *
   * Business rules:
   * - Absent, null and empty string all mean "no date", not an error.
   *   Every date on a tender is optional.
   * - A YYYY-MM-DD input is passed straight through. Parsing it into a
   *   Date and re-serialising would shift it by the server's offset and
   *   store the wrong day — the same class of bug as F-13.
   *
   * Notes:
   * The round-trip comparison catches JavaScript's silent date rollover:
   * `new Date("2026-02-31T00:00:00.000Z")` does not throw, it quietly
   * becomes 2026-03-03. Comparing the re-serialised value against the
   * input is the only way to detect that, and without it a typo would be
   * stored as a real but wrong date.
   *
   * The T00:00:00.000Z suffix forces UTC interpretation. Without it,
   * `new Date("2026-02-31")` is parsed in the server's local zone and the
   * comparison above would fail for legitimate dates west of Greenwich.
   */
  const normaliseOptionalDate = (
    value,
    label
  ) => {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return null;
    }
  
    const cleaned = cleanText(
      String(value)
    );
  
    if (!cleaned) {
      return null;
    }
  
    /*
     * Preserve date-only values to prevent timezone conversion.
     */
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(
        cleaned
      )
    ) {
      const parsedDate = new Date(
        `${cleaned}T00:00:00.000Z`
      );
  
      if (
        Number.isNaN(
          parsedDate.getTime()
        )
      ) {
        throw createValidationError(
          `${label} must be a valid date.`
        );
      }
  
      /*
       * JavaScript automatically normalises invalid dates such as
       * 2026-02-31, so compare the result with the submitted value.
       */
      if (
        parsedDate
          .toISOString()
          .slice(0, 10) !== cleaned
      ) {
        throw createValidationError(
          `${label} must be a valid date.`
        );
      }
  
      return cleaned;
    }
  
    const parsedDate = new Date(cleaned);
  
    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      throw createValidationError(
        `${label} must be a valid date.`
      );
    }
  
    return parsedDate.toISOString();
  };
  
  const normaliseNonNegativeNumber = (
    value,
    {
      label,
      fallback = 0,
      maximum = Number.MAX_SAFE_INTEGER,
    }
  ) => {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return fallback;
    }
  
    const parsed = toNumber(
      value,
      Number.NaN
    );
  
    if (
      !Number.isFinite(parsed) ||
      parsed < 0 ||
      parsed > maximum
    ) {
      throw createValidationError(
        `${label} must be a valid non-negative number.`
      );
    }
  
    return parsed;
  };
  
  const normalisePercentage = (
    value,
    {
      label,
      fallback = 0,
    }
  ) =>
    normaliseNonNegativeNumber(value, {
      label,
      fallback,
      maximum: 100,
    });
  
  /**
   * Constrains a value to one of a fixed set.
   *
   * Purpose:
   * Every status, type, priority and risk level on a tender is a VARCHAR
   * with no CHECK constraint behind it. This is the only thing standing
   * between a request body and a nonsense value being persisted — and a
   * persisted typo is worse than a rejected one, because every later
   * comparison against it silently fails to match.
   *
   * Parameters:
   * value   - the raw field
   * options - { label, allowedValues, fallback, caseInsensitive }
   *             allowedValues   a Set, normally one of the VALID_* sets
   *             fallback        used when the value is blank; omitting it
   *                             makes the field effectively required
   *             caseInsensitive lowercases before comparing, for the
   *                             enumerations stored in lower case
   *
   * Returns:
   * The validated value, or the fallback.
   *
   * Throws:
   * 400 "Invalid {label}." for anything not in the set.
   *
   * Notes:
   * `cleaned || fallback` means an empty string takes the fallback rather
   * than failing — an untouched form field submits "" and should behave as
   * "not supplied".
   *
   * When no fallback is given, a blank value leaves selectedValue falsy
   * and the first half of the guard rejects it. That is how a required
   * enumeration is expressed: pass no fallback.
   *
   * caseInsensitive is opt-in rather than default because some of these
   * enumerations are stored in title case ("Personal Tender") and
   * lowercasing them would break every comparison. See config/constants.js.
   */
  const normaliseEnum = (
    value,
    {
      label,
      allowedValues,
      fallback,
      caseInsensitive = false,
    }
  ) => {
    const cleaned = caseInsensitive
      ? cleanLowerText(value)
      : cleanText(value);
  
    const selectedValue =
      cleaned || fallback;
  
    if (
      !selectedValue ||
      !allowedValues.has(
        selectedValue
      )
    ) {
      throw createValidationError(
        `Invalid ${label}.`
      );
    }
  
    return selectedValue;
  };
  
  const normaliseRequiredText = (
    value,
    label,
    maximumLength = 255
  ) => {
    const cleaned = cleanText(value);
  
    if (!cleaned) {
      throw createValidationError(
        `${label} is required.`
      );
    }
  
    if (
      cleaned.length >
      maximumLength
    ) {
      throw createValidationError(
        `${label} must contain no more than ${maximumLength} characters.`
      );
    }
  
    return cleaned;
  };
  
  const normaliseOptionalText = (
    value,
    maximumLength = null,
    label = "Value"
  ) => {
    const cleaned = emptyToNull(value);
  
    if (
      cleaned !== null &&
      maximumLength &&
      String(cleaned).length >
        maximumLength
    ) {
      throw createValidationError(
        `${label} must contain no more than ${maximumLength} characters.`
      );
    }
  
    return cleaned;
  };
  
  const normaliseOptionalPositiveId = (
    value,
    label
  ) => {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return null;
    }
  
    const id = toPositiveInteger(value);
  
    if (!id) {
      throw createValidationError(
        `Invalid ${label}.`
      );
    }
  
    return id;
  };
  
  const normaliseRequiredPositiveId = (
    value,
    label
  ) => {
    const id = toPositiveInteger(value);
  
    if (!id) {
      throw createValidationError(
        `${label} is required.`
      );
    }
  
    return id;
  };
  
  /**
   * Rejects a pair of dates that are the wrong way round.
   *
   * Purpose:
   * The one cross-field rule in this file. A tender due before it starts,
   * or a site finishing before it began, is a data-entry error the
   * database has no way to catch.
   *
   * Parameters:
   * earlierDate - the date that should come first
   * laterDate   - the date that should come second
   * message     - the full user-facing message, supplied by the caller so
   *               it can name the actual fields
   *
   * Returns:
   * Nothing. Throws on failure.
   *
   * Throws:
   * 400 with the supplied message.
   *
   * Notes:
   * Both dates must be present for the check to apply — either being null
   * short-circuits it, because an optional date that was not supplied
   * cannot be out of order.
   *
   * Equal dates pass: a job that starts and finishes on the same day is
   * normal, so the comparison is strictly less-than.
   *
   * Comparing `new Date(a) < new Date(b)` on two YYYY-MM-DD strings is
   * safe here — both are parsed as UTC midnight, so the offset is
   * identical on each side and cancels out. It would NOT be safe if one
   * side were a date and the other a timestamp.
   */
  const validateDateOrder = (
    earlierDate,
    laterDate,
    message
  ) => {
    if (
      earlierDate &&
      laterDate &&
      new Date(laterDate) <
        new Date(earlierDate)
    ) {
      throw createValidationError(message);
    }
  };
  
  /*
  |--------------------------------------------------------------------------
  | Tender validation
  |--------------------------------------------------------------------------
  |
  | normaliseTenderPayload does the work for both create and update. The
  | difference between them is the `existing` argument: create passes
  | nothing and every required field must be present, update passes the
  | stored row so an omitted field keeps its current value.
  |
  | That is what makes PUT a partial update without a separate code path,
  | and why updateTender in the service loads the tender BEFORE validating.
  |
  */
  
  const normaliseTenderPayload = (
    payload = {},
    existingTender = {}
  ) => {
    const title = normaliseRequiredText(
      getPayloadValue(
        payload,
        existingTender,
        "title"
      ),
      "Tender title",
      255
    );
  
    const tenderType = normaliseEnum(
      getPayloadValue(
        payload,
        existingTender,
        "tender_type"
      ),
      {
        label: "tender type",
        allowedValues:
          VALID_TENDER_TYPES,
        fallback:
          DEFAULTS.TENDER_TYPE,
      }
    );
  
    const status = normaliseEnum(
      getPayloadValue(
        payload,
        existingTender,
        "status"
      ),
      {
        label: "tender status",
        allowedValues:
          VALID_TENDER_STATUSES,
        fallback:
          DEFAULTS.TENDER_STATUS,
      }
    );
  
    const priority = normaliseEnum(
      getPayloadValue(
        payload,
        existingTender,
        "priority"
      ),
      {
        label: "tender priority",
        allowedValues:
          VALID_PRIORITIES,
        fallback:
          DEFAULTS.TENDER_PRIORITY,
      }
    );
  
    const riskLevel = normaliseEnum(
      getPayloadValue(
        payload,
        existingTender,
        "risk_level"
      ),
      {
        label: "tender risk level",
        allowedValues:
          VALID_RISK_LEVELS,
        fallback:
          DEFAULTS.TENDER_RISK,
      }
    );
  
    const startDate =
      normaliseOptionalDate(
        getPayloadValue(
          payload,
          existingTender,
          "start_date"
        ),
        "Tender start date"
      );
  
    const dueDate =
      normaliseOptionalDate(
        getPayloadValue(
          payload,
          existingTender,
          "due_date"
        ),
        "Tender due date"
      );
  
    validateDateOrder(
      startDate,
      dueDate,
      "Tender due date cannot be earlier than the start date."
    );
  
    const clientId =
      normaliseOptionalPositiveId(
        getPayloadValue(
          payload,
          existingTender,
          "client_id"
        ),
        "client ID"
      );
  
    const currencyCode = cleanText(
      getPayloadValue(
        payload,
        existingTender,
        "currency_code"
      ) || "AUD"
    ).toUpperCase();
  
    if (
      !/^[A-Z]{3}$/.test(
        currencyCode
      )
    ) {
      throw createValidationError(
        "Currency code must contain exactly three letters."
      );
    }
  
    return {
      title,
  
      client_id: clientId,
  
      client_name:
        normaliseOptionalText(
          getPayloadValue(
            payload,
            existingTender,
            "client_name"
          ),
          255,
          "Client name"
        ),
  
      contract_number:
        normaliseOptionalText(
          getPayloadValue(
            payload,
            existingTender,
            "contract_number"
          ),
          255,
          "Contract number"
        ),
  
      tender_type: tenderType,
      status,
      priority,
      risk_level: riskLevel,
  
      start_date: startDate,
      due_date: dueDate,
  
      description:
        normaliseOptionalText(
          getPayloadValue(
            payload,
            existingTender,
            "description"
          )
        ),
  
      estimated_value:
        normaliseNonNegativeNumber(
          getPayloadValue(
            payload,
            existingTender,
            "estimated_value"
          ),
          {
            label: "Tender value",
            fallback: 0,
          }
        ),
  
      estimated_margin:
        normaliseNonNegativeNumber(
          getPayloadValue(
            payload,
            existingTender,
            "estimated_margin"
          ),
          {
            label: "Estimated margin",
            fallback: 0,
          }
        ),
  
      actual_margin:
        normaliseNonNegativeNumber(
          getPayloadValue(
            payload,
            existingTender,
            "actual_margin"
          ),
          {
            label: "Actual margin",
            fallback: 0,
          }
        ),
  
      currency_code: currencyCode,
    };
  };
  
  /*
  |--------------------------------------------------------------------------
  | Tender site validation
  |--------------------------------------------------------------------------
  |
  | Sites arrive nested inside the tender payload rather than as their own
  | request, so they are validated here rather than in a sites module.
  |
  | normaliseTenderSites enforces that a tender has at least one site on
  | create — a tender with nowhere to work is not a usable record.
  |
  | A submitted site carrying an `id` is an edit of an existing row; one
  | without is a new site. The service acts on that distinction in
  | synchroniseTenderSites, and checks the id really belongs to this tender
  | before touching it.
  |
  */
  
  const normaliseTenderSite = (
    site = {},
    index = 0
  ) => {
    const siteNumber = index + 1;
  
    const startDate =
      normaliseOptionalDate(
        site.start_date,
        `Tender site ${siteNumber} start date`
      );
  
    const expectedFinishDate =
      normaliseOptionalDate(
        site.expected_finish_date,
        `Tender site ${siteNumber} expected finish date`
      );
  
    const actualFinishDate =
      normaliseOptionalDate(
        site.actual_finish_date,
        `Tender site ${siteNumber} actual finish date`
      );
  
    validateDateOrder(
      startDate,
      expectedFinishDate,
      `Tender site ${siteNumber} expected finish date cannot be earlier than its start date.`
    );
  
    validateDateOrder(
      startDate,
      actualFinishDate,
      `Tender site ${siteNumber} actual finish date cannot be earlier than its start date.`
    );
  
    return {
      id:
        normaliseOptionalPositiveId(
          site.id,
          `tender site ${siteNumber} ID`
        ),
  
      site_name:
        normaliseRequiredText(
          site.site_name,
          `Tender site ${siteNumber} name`,
          255
        ),
  
      site_type:
        normaliseEnum(
          site.site_type,
          {
            label:
              `tender site ${siteNumber} type`,
            allowedValues:
              VALID_SITE_TYPES,
            fallback:
              DEFAULTS.SITE_TYPE,
          }
        ),
  
      address:
        normaliseRequiredText(
          site.address,
          `Tender site ${siteNumber} address`,
          2000
        ),
  
      status:
        normaliseEnum(
          site.status,
          {
            label:
              `tender site ${siteNumber} status`,
            allowedValues:
              VALID_SITE_STATUSES,
            fallback:
              DEFAULTS.SITE_STATUS,
          }
        ),
  
      progress_percent:
        normalisePercentage(
          site.progress_percent,
          {
            label:
              `Tender site ${siteNumber} progress`,
            fallback: 0,
          }
        ),
  
      city:
        normaliseOptionalText(
          site.city,
          255,
          `Tender site ${siteNumber} city`
        ),
  
      state:
        normaliseOptionalText(
          site.state,
          255,
          `Tender site ${siteNumber} state`
        ),
  
      postcode:
        normaliseOptionalText(
          site.postcode,
          50,
          `Tender site ${siteNumber} postcode`
        ),
  
      country:
        normaliseOptionalText(
          site.country,
          255,
          `Tender site ${siteNumber} country`
        ) || "Australia",
  
      start_date: startDate,
  
      expected_finish_date:
        expectedFinishDate,
  
      actual_finish_date:
        actualFinishDate,
  
      site_manager_id:
        normaliseOptionalPositiveId(
          site.site_manager_id,
          `tender site ${siteNumber} manager ID`
        ),
  
      budget:
        normaliseNonNegativeNumber(
          site.budget,
          {
            label:
              `Tender site ${siteNumber} budget`,
            fallback: 0,
          }
        ),
    };
  };
  
  const normaliseTenderSites = (
    sites,
    {
      required = false,
    } = {}
  ) => {
    if (
      sites === undefined ||
      sites === null
    ) {
      if (required) {
        throw createValidationError(
          "At least one tender site is required."
        );
      }
  
      return undefined;
    }
  
    if (!Array.isArray(sites)) {
      throw createValidationError(
        "Tender sites must be supplied as an array."
      );
    }
  
    if (
      required &&
      sites.length === 0
    ) {
      throw createValidationError(
        "At least one tender site is required."
      );
    }
  
    const normalisedSites =
      sites.map(
        normaliseTenderSite
      );
  
    const submittedIds =
      normalisedSites
        .map((site) => site.id)
        .filter(Boolean);
  
    if (
      submittedIds.length !==
      new Set(submittedIds).size
    ) {
      throw createValidationError(
        "The same tender site cannot be submitted more than once."
      );
    }
  
    return normalisedSites;
  };
  
  const validateCreateTender = (
    payload = {}
  ) => ({
    tender:
      normaliseTenderPayload(payload),
  
    sites:
      normaliseTenderSites(
        payload.sites,
        {
          required: true,
        }
      ),
  });
  
  const validateUpdateTender = (
    payload = {},
    existingTender = {}
  ) => ({
    tender:
      normaliseTenderPayload(
        payload,
        existingTender
      ),
  
    /*
     * Omitting sites preserves all existing sites.
     * Sending an empty array requests removal of all active sites.
     */
    sites:
      normaliseTenderSites(
        payload.sites,
        {
          required: false,
        }
      ),
  });
  
  /*
  |--------------------------------------------------------------------------
  | Tender filter validation
  |--------------------------------------------------------------------------
  */
  
  /**
   * Parses and allow-lists the tender register's query string.
   *
   * Purpose:
   * GET /api/tenders forwards req.query wholesale from the controller.
   * This is where it becomes trustworthy — the filter object returned here
   * is what buildTenderFilterQuery turns into SQL.
   *
   * Parameters:
   * query - req.query, or {} when absent
   *
   * Returns:
   * A filter object with a fixed set of keys: search, status, tender_type,
   * priority, risk_level, client_id, minimum_value, maximum_value,
   * due_from, due_to, deleted, limit and offset. Anything else in the
   * query string is discarded.
   *
   * Throws:
   * 400 naming the offending filter.
   *
   * Security:
   * The allow-list is the protection. Only keys named here reach the query
   * builder, so a client cannot filter on an arbitrary column — including
   * company_id, which would be an attempt to look into another tenant.
   * Every value that does get through is bound as a parameter, never
   * interpolated.
   *
   * Business rules:
   * - Every filter is optional; an absent one is simply not applied.
   * - The enumerated filters are validated against the same VALID_* sets
   *   the write paths use, so a filter cannot ask for a status that could
   *   never have been stored.
   * - The value bounds are normalised to null when absent rather than 0,
   *   which is what lets buildTenderFilterQuery distinguish "no minimum"
   *   from "a minimum of zero". See the note there.
   * - limit and offset are clamped, so one request cannot ask for the
   *   whole table.
   *
   * Notes:
   * Rejects an invalid filter rather than ignoring it. Silently dropping
   * one would show the user an unfiltered list that looks filtered, which
   * is worse than an error — they would act on the wrong figures.
   */
  const validateTenderFilters = (
    query = {}
  ) => {
    const status =
      cleanText(query.status);
  
    const tenderType =
      cleanText(
        query.tender_type
      );
  
    const priority =
      cleanText(query.priority);
  
    const riskLevel =
      cleanText(
        query.risk_level
      );
  
    if (
      status &&
      !VALID_TENDER_STATUSES.has(
        status
      )
    ) {
      throw createValidationError(
        "Invalid tender status filter."
      );
    }
  
    if (
      tenderType &&
      !VALID_TENDER_TYPES.has(
        tenderType
      )
    ) {
      throw createValidationError(
        "Invalid tender type filter."
      );
    }
  
    if (
      priority &&
      !VALID_PRIORITIES.has(
        priority
      )
    ) {
      throw createValidationError(
        "Invalid tender priority filter."
      );
    }
  
    if (
      riskLevel &&
      !VALID_RISK_LEVELS.has(
        riskLevel
      )
    ) {
      throw createValidationError(
        "Invalid tender risk-level filter."
      );
    }
  
    const clientId =
      normaliseOptionalPositiveId(
        query.client_id,
        "client filter"
      );
  
    const minimumValue =
      query.minimum_value ===
        undefined ||
      query.minimum_value === ""
        ? null
        : normaliseNonNegativeNumber(
            query.minimum_value,
            {
              label:
                "Minimum tender value",
            }
          );
  
    const maximumValue =
      query.maximum_value ===
        undefined ||
      query.maximum_value === ""
        ? null
        : normaliseNonNegativeNumber(
            query.maximum_value,
            {
              label:
                "Maximum tender value",
            }
          );
  
    if (
      minimumValue !== null &&
      maximumValue !== null &&
      minimumValue >
        maximumValue
    ) {
      throw createValidationError(
        "Minimum tender value cannot exceed maximum tender value."
      );
    }
  
    const dueFrom =
      normaliseOptionalDate(
        query.due_from,
        "Due-from date"
      );
  
    const dueTo =
      normaliseOptionalDate(
        query.due_to,
        "Due-to date"
      );
  
    validateDateOrder(
      dueFrom,
      dueTo,
      "Due-to date cannot be earlier than the due-from date."
    );
  
    const limit =
      query.limit === undefined ||
      query.limit === ""
        ? 50
        : Number(query.limit);
  
    const offset =
      query.offset === undefined ||
      query.offset === ""
        ? 0
        : Number(query.offset);
  
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 200
    ) {
      throw createValidationError(
        "Tender result limit must be between 1 and 200."
      );
    }
  
    if (
      !Number.isInteger(offset) ||
      offset < 0
    ) {
      throw createValidationError(
        "Tender result offset must be zero or greater."
      );
    }
  
    return {
      search:
        cleanText(query.search),
  
      status:
        status || null,
  
      tender_type:
        tenderType || null,
  
      priority:
        priority || null,
  
      risk_level:
        riskLevel || null,
  
      client_id:
        clientId,
  
      minimum_value:
        minimumValue,
  
      maximum_value:
        maximumValue,
  
      due_from:
        dueFrom,
  
      due_to:
        dueTo,
  
      /*
       * Deleting a tender is a soft delete, and there was no way to see
       * one afterwards — so POST /api/tenders/:id/restore existed with no
       * way to reach it, and a project deleted by mistake was gone as far
       * as anyone using the app could tell.
       */
      deleted:
        String(query.deleted || "")
          .trim()
          .toLowerCase() === "true",
  
      limit,
      offset,
    };
  };
  
  /*
  |--------------------------------------------------------------------------
  | Tender document validation
  |--------------------------------------------------------------------------
  |
  | Name and storage URL. The file itself is uploaded separately through
  | /api/upload; only its location is recorded on the tender.
  |
  */
  
  const validateTenderDocument = (
    payload = {}
  ) => ({
    document_name:
      normaliseRequiredText(
        payload.document_name,
        "Document name",
        255
      ),
  
    document_type:
      normaliseOptionalText(
        payload.document_type,
        100,
        "Document type"
      ),
  
    file_url:
      normaliseOptionalText(
        payload.file_url,
        5000,
        "File URL"
      ),
  });
  
  /*
  |--------------------------------------------------------------------------
  | Tender material validation
  |--------------------------------------------------------------------------
  |
  | Quantities and rates, so the numeric coercion matters here more than
  | in the other child collections — a quantity arriving as a string would
  | otherwise concatenate rather than add wherever it is totalled.
  |
  */
  
  const validateTenderMaterial = (
    payload = {}
  ) => {
    const quantity =
      normaliseNonNegativeNumber(
        payload.quantity,
        {
          label:
            "Material quantity",
          fallback: 0,
        }
      );
  
    const rate =
      normaliseNonNegativeNumber(
        payload.rate,
        {
          label: "Material rate",
          fallback: 0,
        }
      );
  
    return {
      section_name:
        normaliseRequiredText(
          payload.section_name,
          "Material section",
          255
        ),
  
      material_name:
        normaliseRequiredText(
          payload.material_name,
          "Material name",
          255
        ),
  
      quantity,
  
      unit:
        normaliseOptionalText(
          payload.unit,
          100,
          "Material unit"
        ),
  
      rate,
  
      /*
       * Never trust a client-supplied total_amount.
       */
      total_amount:
        quantity * rate,
  
      vendor_name:
        normaliseOptionalText(
          payload.vendor_name,
          255,
          "Vendor name"
        ),
  
      notes:
        normaliseOptionalText(
          payload.notes
        ),
    };
  };
  
  /*
  |--------------------------------------------------------------------------
  | Tender banking validation
  |--------------------------------------------------------------------------
  |
  | Guarantees, deposits and EMD. These payloads carry account_number,
  | which is why the audit redaction in utils/activityLog.js matters on
  | this path — see F-12.
  |
  */
  
  const validateTenderBanking = (
    payload = {}
  ) => {
    const amount =
      normaliseNonNegativeNumber(
        payload.amount,
        {
          label: "Banking amount",
        }
      );
  
    if (amount <= 0) {
      throw createValidationError(
        "Banking amount must be greater than zero."
      );
    }
  
    const gstAmount =
      normaliseNonNegativeNumber(
        payload.gst_amount,
        {
          label: "GST amount",
          fallback: 0,
        }
      );
  
    if (gstAmount > amount) {
      throw createValidationError(
        "GST amount cannot exceed the banking amount."
      );
    }
  
    return {
      payment_type:
        normaliseRequiredText(
          payload.payment_type,
          "Payment type",
          100
        ),
  
      bank_name:
        normaliseOptionalText(
          payload.bank_name,
          255,
          "Bank name"
        ),
  
      account_name:
        normaliseOptionalText(
          payload.account_name,
          255,
          "Account name"
        ),
  
      account_number:
        normaliseOptionalText(
          payload.account_number,
          255,
          "Account number"
        ),
  
      amount,
      gst_amount: gstAmount,
  
      notes:
        normaliseOptionalText(
          payload.notes
        ),
  
      payment_date:
        normaliseOptionalDate(
          payload.payment_date,
          "Payment date"
        ),
    };
  };
  
  /*
  |--------------------------------------------------------------------------
  | Tender subcontractor validation
  |--------------------------------------------------------------------------
  |
  | An assignment payload: which subcontractor, what scope, what amount.
  | The subcontractor_id is validated for SHAPE here; whether it belongs to
  | the caller's company is checked in the service, which needs a query.
  |
  */
  
  const validateTenderSubcontractor = (
    payload = {},
    {
      requireSubcontractorId = true,
    } = {}
  ) => ({
    subcontractor_id:
      requireSubcontractorId
        ? normaliseRequiredPositiveId(
            payload.subcontractor_id,
            "Subcontractor"
          )
        : normaliseOptionalPositiveId(
            payload.subcontractor_id,
            "subcontractor ID"
          ),
  
    work_description:
      normaliseOptionalText(
        payload.work_description
      ),
  
    assigned_amount:
      normaliseNonNegativeNumber(
        payload.assigned_amount,
        {
          label: "Assigned amount",
          fallback: 0,
        }
      ),
  
    status:
      normaliseEnum(
        payload.status,
        {
          label:
            "subcontractor assignment status",
          allowedValues:
            VALID_ASSIGNMENT_STATUSES,
          fallback:
            ASSIGNMENT_STATUS.ACTIVE,
          caseInsensitive: true,
        }
      ),
  });
  
  /*
  |--------------------------------------------------------------------------
  | Tender worker validation
  |--------------------------------------------------------------------------
  |
  | The mirror of subcontractor validation. Same split: shape here,
  | ownership in the service.
  |
  */
  
  const validateTenderWorker = (
    payload = {},
    {
      requireAssignmentIds = true,
    } = {}
  ) => {
    const status =
      normaliseEnum(
        payload.status,
        {
          label:
            "worker assignment status",
          allowedValues:
            VALID_ASSIGNMENT_STATUSES,
          fallback:
            ASSIGNMENT_STATUS.ACTIVE,
          caseInsensitive: true,
        }
      );
  
    let endedAt =
      normaliseOptionalDate(
        payload.ended_at,
        "Assignment end date"
      );
  
    /*
     * Active assignments should not retain an end date.
     */
    if (
      status ===
      ASSIGNMENT_STATUS.ACTIVE
    ) {
      endedAt = null;
    }
  
    return {
      worker_id:
        requireAssignmentIds
          ? normaliseRequiredPositiveId(
              payload.worker_id,
              "Worker"
            )
          : normaliseOptionalPositiveId(
              payload.worker_id,
              "worker ID"
            ),
  
      site_id:
        requireAssignmentIds
          ? normaliseRequiredPositiveId(
              payload.site_id,
              "Tender site"
            )
          : normaliseOptionalPositiveId(
              payload.site_id,
              "tender site ID"
            ),
  
      notes:
        normaliseOptionalText(
          payload.notes
        ),
  
      status,
  
      ended_at:
        endedAt,
    };
  };
  
  /*
  |--------------------------------------------------------------------------
  | Tender finance validation
  |--------------------------------------------------------------------------
  |
  | The most involved of the child validators, because a finance record's
  | required fields depend on its record_type.
  |
  | Note the division of labour with utils/financeCalculations.js: this
  | file checks that the supplied figures are well-formed numbers within
  | range, and that file then DERIVES the ones the record type implies.
  | Validation does not compute anything.
  |
  */
  
  const validateTenderFinanceRecord = (
    payload = {}
  ) => {
    const recordType = cleanText(
      payload.record_type
    ).toUpperCase();
  
    if (
      !recordType ||
      !VALID_FINANCE_TYPES.has(
        recordType
      )
    ) {
      throw createValidationError(
        "Invalid finance record type."
      );
    }
  
    const amount =
      normaliseNonNegativeNumber(
        payload.amount,
        {
          label: "Finance amount",
          fallback: 0,
        }
      );
  
    const gstTotal =
      normaliseNonNegativeNumber(
        payload.gst_total,
        {
          label: "GST total",
          fallback: 0,
        }
      );
  
    const gstDone =
      normaliseNonNegativeNumber(
        payload.gst_done,
        {
          label:
            "GST completed amount",
          fallback: 0,
        }
      );
  
    if (gstDone > gstTotal) {
      throw createValidationError(
        "GST completed amount cannot exceed the GST total."
      );
    }
  
    const companyChargeTotal =
      normaliseNonNegativeNumber(
        payload.company_charge_total,
        {
          label:
            "Company charge total",
          fallback: 0,
        }
      );
  
    const companyChargeDone =
      normaliseNonNegativeNumber(
        payload.company_charge_done,
        {
          label:
            "Company charge completed amount",
          fallback: 0,
        }
      );
  
    if (
      companyChargeDone >
      companyChargeTotal
    ) {
      throw createValidationError(
        "Company charge completed amount cannot exceed the company charge total."
      );
    }
  
    return {
      site_id:
        normaliseOptionalPositiveId(
          payload.site_id,
          "tender site ID"
        ),
  
      record_type:
        recordType,
  
      source_name:
        normaliseOptionalText(
          payload.source_name,
          255,
          "Finance source name"
        ),
  
      payment_mode:
        normaliseOptionalText(
          payload.payment_mode,
          100,
          "Payment mode"
        ),
  
      amount,
  
      interest_percent:
        normalisePercentage(
          payload.interest_percent,
          {
            label:
              "Interest percentage",
            fallback: 0,
          }
        ),
  
      gst_percent:
        normalisePercentage(
          payload.gst_percent,
          {
            label:
              "GST percentage",
            fallback: 0,
          }
        ),
  
      gst_total:
        gstTotal,
  
      gst_done:
        gstDone,
  
      company_charge_percent:
        normalisePercentage(
          payload.company_charge_percent,
          {
            label:
              "Company charge percentage",
            fallback: 0,
          }
        ),
  
      company_charge_total:
        companyChargeTotal,
  
      company_charge_done:
        companyChargeDone,
  
      tds_amount:
        normaliseNonNegativeNumber(
          payload.tds_amount,
          {
            label: "TDS amount",
            fallback: 0,
          }
        ),
  
      record_date:
        normaliseOptionalDate(
          payload.record_date,
          "Finance record date"
        ),
  
      notes:
        normaliseOptionalText(
          payload.notes
        ),
  
      status:
        normaliseEnum(
          payload.status,
          {
            label:
              "finance record status",
            allowedValues:
              VALID_RECORD_STATUSES,
            fallback:
              RECORD_STATUS.ACTIVE,
            caseInsensitive: true,
          }
        ),
    };
  };
  
  /*
  |--------------------------------------------------------------------------
  | Public API
  |--------------------------------------------------------------------------
  |
  | Only service-used validators are exported.
  | Internal helpers remain private to prevent duplicated validation logic.
  |
  */
  
  module.exports = {
    validateCreateTender,
    validateUpdateTender,
    validateTenderFilters,
  
    validateTenderDocument,
    validateTenderMaterial,
    validateTenderBanking,
    validateTenderSubcontractor,
    validateTenderWorker,
    validateTenderFinanceRecord,
  };