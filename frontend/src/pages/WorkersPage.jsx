import {
  useMemo,
  useState,
} from "react";

import toast from "react-hot-toast";

import DeleteVerificationModal from "../components/DeleteVerificationModal";
import ExportButtons from "../components/export/ExportButtons";

import { updateWorker } from "../services/workerService";
import { formatCurrency } from "../utils/currency";

import { useAuth } from "../contexts/AuthContext";
import useWorkers from "../hooks/useWorkers";

const EMPTY_EDIT_FORM = {
  full_name: "",
  phone: "",
  salary: "",
  role: "",
  status: "active",
};

function WorkersPage() {
  const { user } = useAuth();

  const {
    workers = [],
    addWorker,
    removeWorker,
    fetchWorkers,
  } = useWorkers(user);

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState(null);

  const [
    editingWorker,
    setEditingWorker,
  ] = useState(null);

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [
    editForm,
    setEditForm,
  ] = useState(EMPTY_EDIT_FORM);

  const [
    adding,
    setAdding,
  ] = useState(false);

  const [
    updating,
    setUpdating,
  ] = useState(false);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const money = formatCurrency;

  const normaliseStatus = (value) =>
    String(value || "active")
      .trim()
      .toLowerCase();

  const normaliseText = (value) =>
    String(value || "").trim();

  const getStatusClass = (status) =>
    normaliseStatus(status) === "active"
      ? "badge green"
      : "badge yellow";

  const filteredWorkers = useMemo(() => {
    const search = searchTerm
      .trim()
      .toLowerCase();

    return workers.filter((worker) => {
      const status =
        normaliseStatus(worker.status);

      const matchesStatus =
        statusFilter === "all" ||
        status === statusFilter;

      const searchableText = [
        worker.full_name,
        worker.phone,
        worker.role,
        worker.salary,
        status,
      ]
        .filter(
          (value) =>
            value !== null &&
            value !== undefined
        )
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !search ||
        searchableText.includes(search);

      return (
        matchesStatus &&
        matchesSearch
      );
    });
  }, [
    workers,
    searchTerm,
    statusFilter,
  ]);

  const activeWorkers = useMemo(
    () =>
      workers.filter(
        (worker) =>
          normaliseStatus(
            worker.status
          ) === "active"
      ),
    [workers]
  );

  const inactiveWorkers = useMemo(
    () =>
      workers.filter(
        (worker) =>
          normaliseStatus(
            worker.status
          ) === "inactive"
      ),
    [workers]
  );

  const totalSalary = useMemo(
    () =>
      workers.reduce(
        (sum, worker) =>
          sum +
          Number(
            worker.salary || 0
          ),
        0
      ),
    [workers]
  );

  const filteredSalary = useMemo(
    () =>
      filteredWorkers.reduce(
        (sum, worker) =>
          sum +
          Number(
            worker.salary || 0
          ),
        0
      ),
    [filteredWorkers]
  );

  const averageSalary =
    workers.length > 0
      ? totalSalary /
        workers.length
      : 0;

  const workerExportColumns = [
    {
      key: "full_name",
      label: "Worker Name",
    },
    {
      key: "phone",
      label: "Phone",
    },
    {
      key: "role",
      label: "Role",
    },
    {
      key: "salary",
      label: "Salary",
    },
    {
      key: "status",
      label: "Status",
    },
  ];

  const workerExportRows =
    filteredWorkers.map(
      (worker) => ({
        full_name:
          worker.full_name || "",
        phone:
          worker.phone || "",
        role:
          worker.role || "",
        salary:
          money(worker.salary),
        status:
          normaliseStatus(
            worker.status
          ),
      })
    );

  const workerExportSummary = {
    "Total Workers":
      workers.length,

    "Active Workers":
      activeWorkers.length,

    "Inactive Workers":
      inactiveWorkers.length,

    "Total Salary":
      money(totalSalary),

    "Average Salary":
      money(averageSalary),

    "Filtered Workers":
      filteredWorkers.length,

    "Filtered Salary":
      money(filteredSalary),
  };

  const validateWorker = ({
    full_name,
    phone,
    salary,
    role,
    status,
  }) => {
    if (!full_name) {
      toast.error(
        "Worker name is required."
      );
      return false;
    }

    if (!phone) {
      toast.error(
        "Phone number is required."
      );
      return false;
    }

    if (!role) {
      toast.error(
        "Worker role is required."
      );
      return false;
    }

    if (
      Number.isNaN(salary) ||
      salary < 0
    ) {
      toast.error(
        "Salary must be zero or greater."
      );
      return false;
    }

    if (
      ![
        "active",
        "inactive",
      ].includes(status)
    ) {
      toast.error(
        "Select a valid worker status."
      );
      return false;
    }

    return true;
  };

  const handleAddWorker =
    async (event) => {
      event.preventDefault();

      if (adding) {
        return;
      }

      if (
        typeof addWorker !==
        "function"
      ) {
        toast.error(
          "Add worker function is unavailable."
        );
        return;
      }

      const form =
        event.currentTarget;

      const payload = {
        company_id:
          user?.company_id ||
          null,

        full_name:
          normaliseText(
            form.full_name.value
          ),

        phone:
          normaliseText(
            form.phone.value
          ),

        salary:
          Number(
            form.salary.value ||
              0
          ),

        role:
          normaliseText(
            form.role.value
          ),

        status:
          normaliseStatus(
            form.status.value
          ),
      };

      if (
        !validateWorker(payload)
      ) {
        return;
      }

      try {
        setAdding(true);

        await addWorker(payload);

        form.reset();

        toast.success(
          "Worker added successfully."
        );
      } catch (error) {
        console.error(
          "Failed to add worker:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            "Failed to add worker."
        );
      } finally {
        setAdding(false);
      }
    };

  const startEdit = (worker) => {
    if (
      adding ||
      updating ||
      deleting
    ) {
      return;
    }

    setEditingWorker(worker);

    setEditForm({
      full_name:
        worker.full_name || "",
      phone:
        worker.phone || "",
      salary:
        worker.salary ?? "",
      role:
        worker.role || "",
      status:
        normaliseStatus(
          worker.status
        ),
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const cancelEdit = () => {
    if (updating) {
      return;
    }

    setEditingWorker(null);

    setEditForm(
      EMPTY_EDIT_FORM
    );
  };

  const handleEditChange = (
    event
  ) => {
    const { name, value } =
      event.target;

    setEditForm(
      (previousForm) => ({
        ...previousForm,
        [name]: value,
      })
    );
  };

  const handleUpdateWorker =
    async (event) => {
      event.preventDefault();

      if (
        !editingWorker ||
        updating
      ) {
        return;
      }

      const payload = {
        company_id:
          editingWorker.company_id ||
          user?.company_id ||
          null,

        full_name:
          normaliseText(
            editForm.full_name
          ),

        phone:
          normaliseText(
            editForm.phone
          ),

        salary:
          Number(
            editForm.salary || 0
          ),

        role:
          normaliseText(
            editForm.role
          ),

        status:
          normaliseStatus(
            editForm.status
          ),
      };

      if (
        !validateWorker(payload)
      ) {
        return;
      }

      try {
        setUpdating(true);

        await updateWorker(
          editingWorker.id,
          payload
        );

        if (
          typeof fetchWorkers ===
          "function"
        ) {
          await fetchWorkers();
        }

        setEditingWorker(null);

        setEditForm(
          EMPTY_EDIT_FORM
        );

        toast.success(
          "Worker updated successfully."
        );
      } catch (error) {
        console.error(
          "Failed to update worker:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            "Failed to update worker."
        );
      } finally {
        setUpdating(false);
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

      if (
        typeof removeWorker !==
        "function"
      ) {
        toast.error(
          "Delete worker function is unavailable."
        );
        return;
      }

      try {
        setDeleting(true);

        await removeWorker(
          deleteTarget.id
        );

        if (
          editingWorker?.id ===
          deleteTarget.id
        ) {
          setEditingWorker(null);

          setEditForm(
            EMPTY_EDIT_FORM
          );
        }

        setDeleteTarget(null);

        toast.success(
          "Worker deleted successfully."
        );
      } catch (error) {
        console.error(
          "Failed to delete worker:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            "Failed to delete worker."
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
    adding ||
    updating ||
    deleting;

  return (
    <>
      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              Workers Management
            </h2>

            <p className="muted-text">
              Manage labour records,
              salary details, roles and
              worker status.
            </p>
          </div>

          <ExportButtons
            filename="workers"
            title="Workers Report"
            subtitle="Construction Portal worker register"
            rows={workerExportRows}
            columns={
              workerExportColumns
            }
            summary={
              workerExportSummary
            }
          />
        </div>
      </section>

      <section className="summary-cards">
        <div className="card">
          <p>Total Workers</p>
          <h2>
            {workers.length}
          </h2>
        </div>

        <div className="card highlight-success">
          <p>Active Workers</p>
          <h2>
            {
              activeWorkers.length
            }
          </h2>
        </div>

        <div className="card highlight-warning">
          <p>Inactive Workers</p>
          <h2>
            {
              inactiveWorkers.length
            }
          </h2>
        </div>

        <div className="card">
          <p>Total Salary</p>
          <h2>
            {money(totalSalary)}
          </h2>
        </div>

        <div className="card">
          <p>Average Salary</p>
          <h2>
            {money(averageSalary)}
          </h2>
        </div>

        <div className="card">
          <p>Filtered Salary</p>
          <h2>
            {money(filteredSalary)}
          </h2>
        </div>
      </section>

      <section className="payment-grid">
        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                {editingWorker
                  ? "Edit Worker"
                  : "Add Worker"}
              </h2>

              <p className="muted-text">
                {editingWorker
                  ? "Update worker details and employment status."
                  : "Create a new worker record for allocations and site updates."}
              </p>
            </div>
          </div>

          {editingWorker ? (
            <form
              className="payment-form"
              onSubmit={
                handleUpdateWorker
              }
            >
              <div className="form-grid">
                <label>
                  Worker Name
                  <input
                    name="full_name"
                    value={
                      editForm.full_name
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      updating
                    }
                    required
                  />
                </label>

                <label>
                  Phone Number
                  <input
                    name="phone"
                    type="tel"
                    value={
                      editForm.phone
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      updating
                    }
                    required
                  />
                </label>

                <label>
                  Salary
                  <input
                    name="salary"
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      editForm.salary
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      updating
                    }
                    required
                  />
                </label>

                <label>
                  Role
                  <input
                    name="role"
                    value={
                      editForm.role
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      updating
                    }
                    required
                  />
                </label>

                <label>
                  Status
                  <select
                    name="status"
                    value={
                      editForm.status
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      updating
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

              <div className="form-preview-total">
                Salary Preview:{" "}
                {money(
                  editForm.salary
                )}
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  disabled={
                    updating
                  }
                >
                  {updating
                    ? "Saving..."
                    : "Save Changes"}
                </button>

                <button
                  type="button"
                  className="secondary-btn"
                  onClick={
                    cancelEdit
                  }
                  disabled={
                    updating
                  }
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <form
              className="payment-form"
              onSubmit={
                handleAddWorker
              }
            >
              <div className="form-grid">
                <label>
                  Worker Name
                  <input
                    name="full_name"
                    placeholder="Worker name"
                    disabled={adding}
                    required
                  />
                </label>

                <label>
                  Phone Number
                  <input
                    name="phone"
                    type="tel"
                    placeholder="Phone number"
                    disabled={adding}
                    required
                  />
                </label>

                <label>
                  Salary
                  <input
                    name="salary"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    disabled={adding}
                    required
                  />
                </label>

                <label>
                  Role
                  <input
                    name="role"
                    placeholder="Example: Labourer"
                    disabled={adding}
                    required
                  />
                </label>

                <label>
                  Status
                  <select
                    name="status"
                    defaultValue="active"
                    disabled={adding}
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

              <button
                type="submit"
                disabled={adding}
              >
                {adding
                  ? "Adding..."
                  : "Add Worker"}
              </button>
            </form>
          )}
        </section>

        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                Worker Search
              </h2>

              <p className="muted-text">
                Search by name, phone,
                role, salary or status.
              </p>
            </div>

            <button
              type="button"
              className="secondary-btn"
              onClick={resetFilters}
              disabled={isBusy}
            >
              Reset
            </button>
          </div>

          <label>
            Search
            <input
              className="search-input"
              type="search"
              placeholder="Search workers..."
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(
                  event.target.value
                )
              }
              disabled={isBusy}
            />
          </label>

          <label>
            Status
            <select
              value={
                statusFilter
              }
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              disabled={isBusy}
            >
              <option value="all">
                All Statuses
              </option>

              <option value="active">
                Active
              </option>

              <option value="inactive">
                Inactive
              </option>
            </select>
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
                  Matching Workers
                </td>
                <td className="number-cell">
                  {
                    filteredWorkers.length
                  }
                </td>
              </tr>

              <tr>
                <td>
                  Matching Salary
                </td>
                <td className="amount-cell">
                  {money(
                    filteredSalary
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </section>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              Workers Register
            </h2>

            <p className="muted-text">
              {filteredWorkers.length}{" "}
              matching worker
              {filteredWorkers.length ===
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
                <th>Phone</th>
                <th>Salary</th>
                <th>Role</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredWorkers.map(
                (worker) => (
                  <tr key={worker.id}>
                    <td>
                      {worker.full_name ||
                        "-"}
                    </td>

                    <td>
                      {worker.phone ||
                        "-"}
                    </td>

                    <td className="amount-cell">
                      {money(
                        worker.salary
                      )}
                    </td>

                    <td>
                      {worker.role ||
                        "-"}
                    </td>

                    <td>
                      <span
                        className={getStatusClass(
                          worker.status
                        )}
                      >
                        {normaliseStatus(
                          worker.status
                        )}
                      </span>
                    </td>

                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          onClick={() =>
                            startEdit(
                              worker
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
                          className="delete-btn"
                          onClick={() =>
                            setDeleteTarget(
                              worker
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

              {filteredWorkers.length ===
                0 && (
                <tr>
                  <td
                    colSpan="6"
                    className="empty-table-message"
                  >
                    No workers found.
                  </td>
                </tr>
              )}
            </tbody>

            {filteredWorkers.length >
              0 && (
              <tfoot>
                <tr>
                  <td colSpan="2">
                    <strong>
                      Total
                    </strong>
                  </td>

                  <td className="amount-cell">
                    <strong>
                      {money(
                        filteredSalary
                      )}
                    </strong>
                  </td>

                  <td colSpan="3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <DeleteVerificationModal
        open={Boolean(
          deleteTarget
        )}
        itemName={
          deleteTarget?.full_name ||
          "worker"
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

export default WorkersPage;