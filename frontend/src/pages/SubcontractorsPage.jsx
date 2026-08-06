/**
 * File purpose:
 * The subcontractor register, including their payment details.
 *
 * State:
 * - Local: search, status filter, the form, the detail modal, export state.
 *
 * Hooks and context:
 * - None; loads through subcontractorService directly
 *
 * API endpoints:
 * - GET/POST/PUT/DELETE /subcontractors via subcontractorService.js
 *
 * Parent:
 * - AppLayout
 *
 * Important notes:
 * - Office-only.
 * - The edit form, the detail modal and the CSV/PDF export all read bank
 * - details straight from the LIST response — there is no per-record fetch,
 * - and the backend does not route one. That is why the list returns full
 * - account numbers. See F-12 in docs/repository-reference/findings.md before
 * - changing any of those three.
 */

import {
  useCallback,
  useMemo,
  useState,
} from "react";

import toast from "react-hot-toast";

import DeleteVerificationModal from "../components/DeleteVerificationModal";
import ExportButtons from "../components/export/ExportButtons";

import { useAuth } from "../contexts/authContext";

import {
  getSubcontractors,
  getSubcontractorById,
  createSubcontractor,
  deleteSubcontractor,
  updateSubcontractor,
} from "../services/subcontractorService";

import useAsyncResource from "../hooks/useAsyncResource";
import ResponsiveTable from "../components/ui/ResponsiveTable";

const EMPTY_FORM = {
  full_name: "",
  phone: "",
  email: "",
  business_name: "",
  gst_number: "",
  bank_name: "",
  account_name: "",
  account_number: "",
  ifsc_code: "",
  status: "active",
};

function SubcontractorsPage() {
  const { user } = useAuth();

  /*
   * Whether this user may see and edit unmasked payment details (F-12).
   *
   * Mirrors canSeeFinancialDetails on the backend — administrators only,
   * from either the account role or the company membership role.
   *
   * PRESENTATION ONLY. Hiding the banking inputs stops a manager
   * overwriting values they cannot read; it is not what protects them. The
   * backend answers 403 on GET /subcontractors/:id regardless of what this
   * page renders.
   */
  const canEditFinancials = [
    user?.role,
    user?.company_role,
  ].some(
    (role) =>
      String(role || "")
        .trim()
        .toLowerCase() === "admin"
  );

  const fetchSubcontractorList = useCallback(
    async () => {
      const data = await getSubcontractors();

      const records =
        data?.subcontractors ||
        data?.data?.subcontractors ||
        data?.data ||
        [];

      return Array.isArray(records) ? records : [];
    },
    []
  );

  const {
    data: subcontractors,
    loading,
    error: loadError,
    reload: fetchSubcontractors,
  } = useAsyncResource(fetchSubcontractorList, {
    label: "subcontractors",
  });

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState(null);

  const [
    editingSubcontractor,
    setEditingSubcontractor,
  ] = useState(null);

  const [
    selectedSubcontractor,
    setSelectedSubcontractor,
  ] = useState(null);

  /*
   * The unmasked payment details for whichever record is open (F-12).
   *
   * Held SEPARATELY from `subcontractors`, and only ever for one record at
   * a time, so full account numbers never enter the shared list state.
   * Cleared by closeDetails whenever the modal or the edit form closes.
   *
   *   null      nothing open, or not yet loaded
   *   object    the full record
   */
  const [
    financialDetails,
    setFinancialDetails,
  ] = useState(null);

  // True while GET /subcontractors/:id is in flight.
  const [
    loadingFinancials,
    setLoadingFinancials,
  ] = useState(false);

  /*
   * Set when the API answers 403 — the caller is in the right company but
   * may not see payment details. Distinct from an error: the masked view
   * is still correct and usable, so the UI shows a note rather than a
   * failure.
   */
  const [
    financialsDenied,
    setFinancialsDenied,
  ] = useState(false);

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [formData, setFormData] =
    useState(EMPTY_FORM);

  const [submitting, setSubmitting] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const normaliseStatus = (value) =>
    String(value || "active")
      .trim()
      .toLowerCase();

  const getStatusClass = (status) =>
    normaliseStatus(status) ===
    "active"
      ? "badge green"
      : "badge yellow";

  const totals = useMemo(() => {
    const active =
      subcontractors.filter(
        (subcontractor) =>
          normaliseStatus(
            subcontractor.status
          ) === "active"
      );

    const inactive =
      subcontractors.filter(
        (subcontractor) =>
          normaliseStatus(
            subcontractor.status
          ) === "inactive"
      );

    const withGST =
      subcontractors.filter(
        (subcontractor) =>
          Boolean(
            String(
              subcontractor.gst_number ||
                ""
            ).trim()
          )
      );

    /*
     * Counted from the has_bank_details flag the list endpoint provides
     * (F-12), not by inspecting an account number — the raw value is no
     * longer in the response, so the old test would count zero for every
     * company.
     */
    const withBankDetails =
      subcontractors.filter(
        (subcontractor) =>
          Boolean(
            subcontractor.has_bank_details
          )
      );

    const withEmail =
      subcontractors.filter(
        (subcontractor) =>
          Boolean(
            String(
              subcontractor.email ||
                ""
            ).trim()
          )
      );

    return {
      active: active.length,
      inactive: inactive.length,
      withGST: withGST.length,
      withBankDetails:
        withBankDetails.length,
      withEmail: withEmail.length,
    };
  }, [subcontractors]);

  const filteredSubcontractors =
    useMemo(() => {
      const search =
        searchTerm
          .trim()
          .toLowerCase();

      return subcontractors.filter(
        (subcontractor) => {
          const status =
            normaliseStatus(
              subcontractor.status
            );

          const matchesStatus =
            statusFilter === "all" ||
            status === statusFilter;

          const searchableText = [
            subcontractor.full_name,
            subcontractor.phone,
            subcontractor.email,
            subcontractor.business_name,
            subcontractor.gst_number,
            subcontractor.bank_name,
            subcontractor.account_name,
            /*
             * account_number and ifsc_code are deliberately absent (F-12).
             * The list no longer carries them, so including them would
             * match nothing — and a searchable account number would let
             * anyone with office access confirm whether a given number is
             * on file by probing this box.
             */
            status,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !search ||
            searchableText.includes(
              search
            );

          return (
            matchesStatus &&
            matchesSearch
          );
        }
      );
    }, [
      subcontractors,
      searchTerm,
      statusFilter,
    ]);

  const subcontractorExportColumns = [
    {
      key: "full_name",
      label: "Name",
    },
    {
      key: "business_name",
      label: "Business",
    },
    {
      key: "phone",
      label: "Phone",
    },
    {
      key: "email",
      label: "Email",
    },
    {
      key: "gst_number",
      label: "GST Number",
    },
    {
      key: "bank_name",
      label: "Bank",
    },
    {
      key: "account_name",
      label: "Account Name",
    },
    /*
     * Masked, not full (F-12).
     *
     * An export leaves the application entirely — it is emailed, saved to
     * a laptop, attached to a message. A CSV carrying every counterparty's
     * account number is the same bulk exposure the list endpoint had, just
     * with a longer life.
     *
     * The last four digits are enough for the reconciliation this export
     * is used for: confirming which account a payment went to. Anyone who
     * needs the full number can open the record, which requires the
     * administrator role and is one counterparty at a time.
     */
    {
      key: "account_number_masked",
      label: "Account Number (masked)",
    },
    {
      key: "status",
      label: "Status",
    },
  ];

  const subcontractorExportRows =
    filteredSubcontractors.map(
      (subcontractor) => ({
        full_name:
          subcontractor.full_name ||
          "",
        business_name:
          subcontractor.business_name ||
          "",
        phone:
          subcontractor.phone || "",
        email:
          subcontractor.email || "",
        gst_number:
          subcontractor.gst_number ||
          "",
        bank_name:
          subcontractor.bank_name ||
          "",
        account_name:
          subcontractor.account_name ||
          "",
        /*
         * Reads the MASKED field the list endpoint provides. The raw
         * account_number is no longer present on these rows at all, so
         * this cannot silently start exporting full values again.
         */
        account_number_masked:
          subcontractor.account_number_masked ||
          "",
        status:
          normaliseStatus(
            subcontractor.status
          ),
      })
    );

  const subcontractorExportSummary = {
    "Total Subcontractors":
      subcontractors.length,
    "Active Subcontractors":
      totals.active,
    "Inactive Subcontractors":
      totals.inactive,
    "GST Registered":
      totals.withGST,
    "Bank Details Available":
      totals.withBankDetails,
    "Email Available":
      totals.withEmail,
    "Filtered Records":
      filteredSubcontractors.length,
  };

  const handleChange = (event) => {
    const { name, value } =
      event.target;

    setFormData(
      (previousForm) => ({
        ...previousForm,
        [name]: value,
      })
    );
  };

  /*
   * Loads the unmasked payment details for one subcontractor (F-12).
   *
   * Called when the detail modal or the edit form opens. The list has only
   * masked identifiers, so this is the request that produces the real
   * values — and it is deliberately made per record rather than once for
   * the register.
   *
   * A 403 is an expected outcome, not a failure: the caller is in the
   * right company but is not an administrator. The masked view they
   * already have stays on screen and a note explains why the full number
   * is absent, so a manager opening a record sees something coherent
   * rather than an error.
   */
  const loadFinancialDetails = useCallback(
    async (subcontractorId) => {
      if (!subcontractorId) {
        return null;
      }

      setLoadingFinancials(true);
      setFinancialsDenied(false);

      try {
        const record =
          await getSubcontractorById(
            subcontractorId
          );

        setFinancialDetails(record);

        return record;
      } catch (error) {
        const status =
          error?.response?.status;

        if (status === 403) {
          setFinancialsDenied(true);
        } else if (status !== 404) {
          toast.error(
            "Could not load payment details."
          );
        }

        setFinancialDetails(null);

        return null;
      } finally {
        setLoadingFinancials(false);
      }
    },
    []
  );

  /*
   * Drops the full details from memory.
   *
   * Called from every path that closes the detail modal or the edit form.
   * The point of F-12 is that account numbers are fetched for a purpose
   * and released when that purpose ends — leaving them in state would
   * reintroduce the bulk exposure one record at a time.
   */
  const clearFinancialDetails =
    useCallback(() => {
      setFinancialDetails(null);
      setFinancialsDenied(false);
      setLoadingFinancials(false);
    }, []);

  /*
   * Opens the preview and loads its payment details (F-12).
   *
   * The list row is shown immediately so the modal is never blank; the
   * unmasked identifiers arrive separately and replace the masked ones
   * when they do.
   */
  const openDetails = useCallback(
    (subcontractor) => {
      setSelectedSubcontractor(
        subcontractor
      );

      loadFinancialDetails(
        subcontractor?.id
      );
    },
    [loadFinancialDetails]
  );

  /*
   * Renders one protected identifier in the preview (F-12).
   *
   * Three states, and each says something different to the reader:
   *
   *   loading  the fetch is in flight
   *   denied   this user may not see the value; the masked form is shown
   *            instead, so the row still confirms details are on file
   *   loaded   the real value
   *
   * The masked fallback matters. A manager who sees "-" cannot tell
   * whether banking is missing or merely hidden from them, and would go
   * looking for a record that is already complete.
   */
  const renderProtectedValue = (
    fullValue,
    maskedValue
  ) => {
    if (loadingFinancials) {
      return "Loading…";
    }

    if (financialsDenied) {
      return maskedValue || "-";
    }

    return fullValue || maskedValue || "-";
  };

  /*
   * Closes the preview and releases anything it loaded.
   */
  const closeDetails = useCallback(() => {
    setSelectedSubcontractor(null);
    clearFinancialDetails();
  }, [clearFinancialDetails]);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingSubcontractor(
      null
    );

    // Leaving the form must release the full details it loaded (F-12).
    clearFinancialDetails();
  };

  const startEdit = (
    subcontractor
  ) => {
    if (
      submitting ||
      deleting
    ) {
      return;
    }

    setEditingSubcontractor(
      subcontractor
    );

    setSelectedSubcontractor(
      subcontractor
    );

    /*
     * Fetch the unmasked values and fill the banking inputs once they
     * arrive (F-12).
     *
     * The row from the list carries only masked identifiers, so seeding
     * the form from it would put "••••9012" in the account-number box —
     * and saving would then write that literal string over the real
     * number.
     *
     * Until the fetch resolves the banking inputs stay EMPTY rather than
     * masked, which matters: the factory's COALESCE treats an empty field
     * as "leave unchanged", so submitting early cannot damage the stored
     * value.
     */
    loadFinancialDetails(subcontractor.id).then(
      (full) => {
        if (!full) {
          return;
        }

        setFormData((previous) => ({
          ...previous,
          bank_name:
            full.bank_name || "",
          account_name:
            full.account_name || "",
          account_number:
            full.account_number || "",
          ifsc_code:
            full.ifsc_code || "",
        }));
      }
    );

    setFormData({
      full_name:
        subcontractor.full_name ||
        "",
      phone:
        subcontractor.phone || "",
      email:
        subcontractor.email || "",
      business_name:
        subcontractor.business_name ||
        "",
      gst_number:
        subcontractor.gst_number ||
        "",
      /*
       * Blank until loadFinancialDetails resolves. The list row has no
       * real values to seed from, and an empty banking field means
       * "unchanged" to the backend — so an early submit is safe.
       */
      bank_name: "",
      account_name: "",
      account_number: "",
      ifsc_code: "",
      status:
        normaliseStatus(
          subcontractor.status
        ),
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const validatePayload = (
    payload
  ) => {
    if (!payload.full_name) {
      toast.error(
        "Subcontractor name is required."
      );
      return false;
    }

    if (
      payload.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        payload.email
      )
    ) {
      toast.error(
        "Enter a valid email address."
      );
      return false;
    }

    if (
      ![
        "active",
        "inactive",
      ].includes(payload.status)
    ) {
      toast.error(
        "Select a valid subcontractor status."
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const payload = {
      full_name:
        formData.full_name.trim(),
      phone:
        formData.phone.trim(),
      email:
        formData.email
          .trim()
          .toLowerCase(),
      business_name:
        formData.business_name.trim(),
      gst_number:
        formData.gst_number.trim(),
      /*
       * Banking fields are included only when this user may edit them
       * (F-12).
       *
       * Omitting them entirely is what protects the stored values: the
       * backend's COALESCE reads an absent field as "leave unchanged", so
       * a manager's edit cannot blank an account number they were never
       * shown. Sending empty strings would be equivalent today — coerce()
       * turns "" into null — but relying on that is fragile, and not
       * sending a field you have no business setting is the clearer rule.
       */
      ...(canEditFinancials
        ? {
            bank_name:
              formData.bank_name.trim(),
            account_name:
              formData.account_name.trim(),
            account_number:
              formData.account_number.trim(),
            ifsc_code:
              formData.ifsc_code.trim(),
          }
        : {}),
      status:
        normaliseStatus(
          formData.status
        ),
    };

    if (
      !validatePayload(payload)
    ) {
      return;
    }

    try {
      setSubmitting(true);

      if (
        editingSubcontractor
      ) {
        await updateSubcontractor(
          editingSubcontractor.id,
          payload
        );

        toast.success(
          "Subcontractor updated successfully."
        );
      } else {
        await createSubcontractor({
          company_id:
            user?.company_id ||
            null,
          ...payload,
        });

        toast.success(
          "Subcontractor added successfully."
        );
      }

      resetForm();

      await fetchSubcontractors({
        showLoader: false,
      });
    } catch (error) {
      console.error(
        "Failed to save subcontractor:",
        error.response?.data ||
          error
      );

      toast.error(
        error.response?.data
          ?.message ||
          "Failed to save subcontractor."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete =
    async () => {
      if (
        !deleteTarget ||
        deleting
      ) {
        return;
      }

      try {
        setDeleting(true);

        await deleteSubcontractor(
          deleteTarget.id
        );

        if (
          selectedSubcontractor?.id ===
          deleteTarget.id
        ) {
          setSelectedSubcontractor(
            null
          );
        }

        if (
          editingSubcontractor?.id ===
          deleteTarget.id
        ) {
          resetForm();
        }

        setDeleteTarget(null);

        await fetchSubcontractors({
          showLoader: false,
        });

        toast.success(
          "Subcontractor deleted successfully."
        );
      } catch (error) {
        console.error(
          "Failed to delete subcontractor:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            "Failed to delete subcontractor."
        );
      } finally {
        setDeleting(false);
      }
    };

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
  };

  const isBusy =
    submitting || deleting;

  if (loading) {
    return (
      <section className="panel">
        <h2>
          Loading subcontractors...
        </h2>

        <p className="muted-text">
          Loading contact, business
          and settlement records.
        </p>
      </section>
    );
  }

  if (
    loadError &&
    subcontractors.length === 0
  ) {
    return (
      <section className="panel">
        <h2>
          Subcontractors could not
          be loaded
        </h2>

        <p
          className="error"
          role="alert"
        >
          {loadError}
        </p>

        <button
          type="button"
          onClick={() =>
            fetchSubcontractors()
          }
        >
          Retry
        </button>
      </section>
    );
  }

  return (
    <>
      {loadError && (
        <section className="panel">
          <p
            className="error"
            role="alert"
          >
            {loadError}
          </p>

          <button
            type="button"
            className="secondary-btn"
            onClick={() =>
              fetchSubcontractors()
            }
          >
            Retry Loading
          </button>
        </section>
      )}

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              Subcontractors
              Management
            </h2>

            <p className="muted-text">
              Manage subcontractor
              contact, business, GST
              and banking information.
            </p>
          </div>

          <ExportButtons
            filename="subcontractors"
            title="Subcontractors Report"
            subtitle="Construction Portal subcontractor register"
            rows={
              subcontractorExportRows
            }
            columns={
              subcontractorExportColumns
            }
            summary={
              subcontractorExportSummary
            }
          />
        </div>
      </section>

      <section className="summary-cards">
        <div className="card">
          <p>
            Total Subcontractors
          </p>
          <h2>
            {
              subcontractors.length
            }
          </h2>
        </div>

        <div className="card highlight-success">
          <p>Active</p>
          <h2>
            {totals.active}
          </h2>
        </div>

        <div className="card highlight-warning">
          <p>Inactive</p>
          <h2>
            {totals.inactive}
          </h2>
        </div>

        <div className="card">
          <p>GST Registered</p>
          <h2>
            {totals.withGST}
          </h2>
        </div>

        <div className="card">
          <p>
            Bank Details Available
          </p>
          <h2>
            {
              totals.withBankDetails
            }
          </h2>
        </div>

        <div className="card">
          <p>Filtered Records</p>
          <h2>
            {
              filteredSubcontractors.length
            }
          </h2>
        </div>
      </section>

      <section className="payment-grid">
        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                {editingSubcontractor
                  ? "Edit Subcontractor"
                  : "Add Subcontractor"}
              </h2>

              <p className="muted-text">
                {editingSubcontractor
                  ? "Update subcontractor identity, business and bank details."
                  : "Create a subcontractor record for future tender assignment."}
              </p>
            </div>
          </div>

          <form
            className="payment-form"
            onSubmit={handleSubmit}
          >
            <div className="form-section-title">
              <h3>
                Contact and Business
                Details
              </h3>

              <p className="muted-text">
                Primary identity and
                communication
                information.
              </p>
            </div>

            <div className="form-grid">
              <label>
                Full Name
                <input
                  name="full_name"
                  value={
                    formData.full_name
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    submitting
                  }
                  required
                />
              </label>

              <label>
                Business Name
                <input
                  name="business_name"
                  value={
                    formData.business_name
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    submitting
                  }
                />
              </label>

              <label>
                Phone
                <input
                  name="phone"
                  type="tel"
                  value={
                    formData.phone
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    submitting
                  }
                />
              </label>

              <label>
                Email
                <input
                  name="email"
                  type="email"
                  value={
                    formData.email
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    submitting
                  }
                />
              </label>

              <label>
                GST Number
                <input
                  name="gst_number"
                  value={
                    formData.gst_number
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    submitting
                  }
                />
              </label>

              <label>
                Status
                <select
                  name="status"
                  value={
                    formData.status
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    submitting
                  }
                  required
                >
                  <option value="active">
                    Active
                  </option>

                  <option value="inactive">
                    Inactive
                  </option>
                </select>
              </label>
            </div>

            {/*
              * Banking inputs are rendered only for a user permitted to
              * read the values (F-12).
              *
              * A manager editing a subcontractor simply does not see this
              * section, and their submission therefore omits the four
              * fields — which the backend's COALESCE treats as "leave
              * unchanged". Without the gate they would see empty inputs
              * and could blank real account details without ever having
              * been shown them.
              */}
            {canEditFinancials && (
              <>
            <div className="form-section-title">
              <h3>
                Banking Details
              </h3>

              <p className="muted-text">
                Payment account details
                used for subcontractor
                settlements.
              </p>
            </div>

            <div className="form-grid">
              <label>
                Bank Name
                <input
                  name="bank_name"
                  value={
                    formData.bank_name
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    submitting
                  }
                />
              </label>

              <label>
                Account Name
                <input
                  name="account_name"
                  value={
                    formData.account_name
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    submitting
                  }
                />
              </label>

              <label>
                Account Number
                <input
                  name="account_number"
                  value={
                    formData.account_number
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    submitting
                  }
                />
              </label>

              <label>
                IFSC / BSB Code
                <input
                  name="ifsc_code"
                  value={
                    formData.ifsc_code
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    submitting
                  }
                />
              </label>
            </div>
              </>
            )}

            <div className="form-preview-total">
              Record Preview:{" "}
              {formData.full_name ||
                "Subcontractor"}

              {formData.business_name
                ? ` · ${formData.business_name}`
                : ""}

              {formData.gst_number
                ? ` · GST ${formData.gst_number}`
                : ""}
            </div>

            <div className="form-actions">
              <button
                type="submit"
                disabled={
                  submitting
                }
              >
                {submitting
                  ? "Saving..."
                  : editingSubcontractor
                    ? "Save Changes"
                    : "Add Subcontractor"}
              </button>

              {editingSubcontractor && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={
                    resetForm
                  }
                  disabled={
                    submitting
                  }
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                Subcontractor Filters
              </h2>

              <p className="muted-text">
                Search by name,
                business, contact, GST,
                bank account or status.
              </p>
            </div>

            <button
              type="button"
              className="secondary-btn"
              onClick={
                resetFilters
              }
              disabled={isBusy}
            >
              Reset
            </button>
          </div>

          <div className="tabs">
            <button
              type="button"
              className={
                statusFilter ===
                "all"
                  ? "active-tab"
                  : ""
              }
              onClick={() =>
                setStatusFilter("all")
              }
              disabled={isBusy}
            >
              All
            </button>

            <button
              type="button"
              className={
                statusFilter ===
                "active"
                  ? "active-tab"
                  : ""
              }
              onClick={() =>
                setStatusFilter(
                  "active"
                )
              }
              disabled={isBusy}
            >
              Active
            </button>

            <button
              type="button"
              className={
                statusFilter ===
                "inactive"
                  ? "active-tab"
                  : ""
              }
              onClick={() =>
                setStatusFilter(
                  "inactive"
                )
              }
              disabled={isBusy}
            >
              Inactive
            </button>
          </div>

          <label>
            Search
            <input
              className="search-input"
              type="search"
              placeholder="Search subcontractors..."
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(
                  event.target.value
                )
              }
              disabled={isBusy}
            />
          </label>

          <table>
            <tbody>
              <tr>
                <td>
                  Status Filter
                </td>
                <td>
                  {statusFilter}
                </td>
              </tr>

              <tr>
                <td>
                  Matching Records
                </td>
                <td className="number-cell">
                  {
                    filteredSubcontractors.length
                  }
                </td>
              </tr>

              <tr>
                <td>
                  GST Registered
                </td>
                <td className="number-cell">
                  {totals.withGST}
                </td>
              </tr>

              <tr>
                <td>
                  Bank Details
                  Available
                </td>
                <td className="number-cell">
                  {
                    totals.withBankDetails
                  }
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </section>

      {selectedSubcontractor && (
        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                Subcontractor Preview
              </h2>

              <p className="muted-text">
                Contact, business and
                settlement information.
              </p>
            </div>

            <button
              type="button"
              className="secondary-btn"
              onClick={closeDetails}
              disabled={deleting}
            >
              Close Preview
            </button>
          </div>

          <section className="summary-cards">
            <div className="card">
              <p>Name</p>
              <h2>
                {selectedSubcontractor.full_name ||
                  "-"}
              </h2>
            </div>

            <div className="card">
              <p>Business</p>
              <h2>
                {selectedSubcontractor.business_name ||
                  "-"}
              </h2>
            </div>

            <div className="card">
              <p>GST Number</p>
              <h2>
                {selectedSubcontractor.gst_number ||
                  "-"}
              </h2>
            </div>

            <div className="card">
              <p>Bank</p>
              <h2>
                {selectedSubcontractor.bank_name ||
                  "-"}
              </h2>
            </div>

            <div className="card">
              <p>Account Name</p>
              <h2>
                {selectedSubcontractor.account_name ||
                  "-"}
              </h2>
            </div>

            <div className="card">
              <p>Status</p>
              <h2>
                <span
                  className={getStatusClass(
                    selectedSubcontractor.status
                  )}
                >
                  {normaliseStatus(
                    selectedSubcontractor.status
                  )}
                </span>
              </h2>
            </div>
          </section>

          <div className="table-wrapper" tabIndex={0}>
            <table>
              <tbody>
                <tr>
                  <th>Phone</th>
                  <td>
                    {selectedSubcontractor.phone ||
                      "-"}
                  </td>
                </tr>

                <tr>
                  <th>Email</th>
                  <td>
                    {selectedSubcontractor.email ||
                      "-"}
                  </td>
                </tr>

                <tr>
                  <th>
                    Account Number
                  </th>
                  <td>
                    {renderProtectedValue(
                      financialDetails?.account_number,
                      selectedSubcontractor.account_number_masked
                    )}
                  </td>
                </tr>

                <tr>
                  <th>IFSC / BSB</th>
                  <td>
                    {renderProtectedValue(
                      financialDetails?.ifsc_code,
                      selectedSubcontractor.ifsc_code_masked
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              Subcontractors Register
            </h2>

            <p className="muted-text">
              {
                filteredSubcontractors.length
              }{" "}
              matching subcontractor
              {filteredSubcontractors.length ===
              1
                ? ""
                : "s"}
              .
            </p>
          </div>
        </div>

        <ResponsiveTable mobile="cards">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Business</th>
                <th>Phone</th>
                <th>Email</th>
                <th>GST</th>
                <th>Bank</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredSubcontractors.map(
                (subcontractor) => (
                  <tr
                    key={
                      subcontractor.id
                    }
                  >
                    <td>
                      <button
                        type="button"
                        className="table-link-button"
                        onClick={() =>
                          openDetails(
                            subcontractor
                          )
                        }
                        disabled={
                          isBusy
                        }
                      >
                        {subcontractor.full_name ||
                          "-"}
                      </button>
                    </td>

                    <td>
                      {subcontractor.business_name ||
                        "-"}
                    </td>

                    <td>
                      {subcontractor.phone ||
                        "-"}
                    </td>

                    <td>
                      {subcontractor.email ||
                        "-"}
                    </td>

                    <td>
                      {subcontractor.gst_number ||
                        "-"}
                    </td>

                    <td>
                      {subcontractor.bank_name ||
                        "-"}
                    </td>

                    <td>
                      <span
                        className={getStatusClass(
                          subcontractor.status
                        )}
                      >
                        {normaliseStatus(
                          subcontractor.status
                        )}
                      </span>
                    </td>

                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          onClick={() =>
                            startEdit(
                              subcontractor
                            )
                          }
                          disabled={
                            isBusy
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() =>
                            openDetails(
                              subcontractor
                            )
                          }
                          disabled={
                            isBusy
                          }
                        >
                          Preview
                        </button>

                        <button
                          type="button"
                          className="delete-btn"
                          onClick={() =>
                            setDeleteTarget(
                              subcontractor
                            )
                          }
                          disabled={
                            isBusy
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}

              {filteredSubcontractors.length ===
                0 && (
                <tr>
                  <td
                    colSpan="8"
                    className="empty-table-message"
                  >
                    No subcontractors
                    found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ResponsiveTable>
      </section>

      <DeleteVerificationModal
        open={Boolean(
          deleteTarget
        )}
        itemName={
          deleteTarget?.full_name ||
          "subcontractor"
        }
        onCancel={() => {
          if (!deleting) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={
          handleConfirmDelete
        }
        loading={deleting}
      />
    </>
  );
}

export default SubcontractorsPage;