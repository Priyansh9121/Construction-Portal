import {
  useEffect,
  useMemo,
  useState,
} from "react";

import toast from "react-hot-toast";

import DeleteVerificationModal from "../components/DeleteVerificationModal";
import ExportButtons from "../components/export/ExportButtons";

import { useAuth } from "../contexts/AuthContext";

import {
  getSubcontractors,
  createSubcontractor,
  deleteSubcontractor,
  updateSubcontractor,
} from "../services/subcontractorService";

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

  const [
    subcontractors,
    setSubcontractors,
  ] = useState([]);

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

  const [loading, setLoading] =
    useState(true);

  const [loadError, setLoadError] =
    useState("");

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

  const fetchSubcontractors =
    async ({
      showLoader = true,
    } = {}) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        setLoadError("");

        const data =
          await getSubcontractors();

        const records =
          data?.subcontractors ||
          data?.data?.subcontractors ||
          data?.data ||
          [];

        setSubcontractors(
          Array.isArray(records)
            ? records
            : []
        );
      } catch (error) {
        console.error(
          "Failed to load subcontractors:",
          error.response?.data ||
            error
        );

        const message =
          error.response?.data
            ?.message ||
          "Failed to load subcontractors.";

        setLoadError(message);

        if (!showLoader) {
          toast.error(message);
        }
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    };

  useEffect(() => {
    fetchSubcontractors();
  }, []);

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

    const withBankDetails =
      subcontractors.filter(
        (subcontractor) =>
          Boolean(
            String(
              subcontractor.bank_name ||
                ""
            ).trim()
          ) &&
          Boolean(
            String(
              subcontractor.account_number ||
                ""
            ).trim()
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
            subcontractor.account_number,
            subcontractor.ifsc_code,
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
    {
      key: "account_number",
      label: "Account Number",
    },
    {
      key: "ifsc_code",
      label: "IFSC / BSB",
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
        account_number:
          subcontractor.account_number ||
          "",
        ifsc_code:
          subcontractor.ifsc_code ||
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

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingSubcontractor(
      null
    );
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
      bank_name:
        subcontractor.bank_name ||
        "",
      account_name:
        subcontractor.account_name ||
        "",
      account_number:
        subcontractor.account_number ||
        "",
      ifsc_code:
        subcontractor.ifsc_code ||
        "",
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
      bank_name:
        formData.bank_name.trim(),
      account_name:
        formData.account_name.trim(),
      account_number:
        formData.account_number.trim(),
      ifsc_code:
        formData.ifsc_code.trim(),
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
              onClick={() =>
                setSelectedSubcontractor(
                  null
                )
              }
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

          <div className="table-wrapper">
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
                    {selectedSubcontractor.account_number ||
                      "-"}
                  </td>
                </tr>

                <tr>
                  <th>IFSC / BSB</th>
                  <td>
                    {selectedSubcontractor.ifsc_code ||
                      "-"}
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

        <div className="table-wrapper">
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
                          setSelectedSubcontractor(
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
                            setSelectedSubcontractor(
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
        </div>
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