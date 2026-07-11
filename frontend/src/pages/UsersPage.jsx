import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import toast from "react-hot-toast";

import DeleteVerificationModal from "../components/DeleteVerificationModal";
import ExportButtons from "../components/export/ExportButtons";

import { useAuth } from "../contexts/AuthContext";

import {
  getUsers,
  createUser,
  updateUser,
  disableUser,
} from "../services/userService";

const EMPTY_FORM = {
  full_name: "",
  email: "",
  password: "",
  role: "worker",
  status: "active",
};

const ALLOWED_ROLES = [
  "admin",
  "manager",
  "worker",
  "subcontractor",
];

const ALLOWED_STATUSES = [
  "active",
  "inactive",
];

function UsersPage() {
  const { user: currentUser } =
    useAuth();

  const [users, setUsers] =
    useState([]);

  const [formData, setFormData] =
    useState(EMPTY_FORM);

  const [
    editingUser,
    setEditingUser,
  ] = useState(null);

  const [
    selectedUser,
    setSelectedUser,
  ] = useState(null);

  const [
    disableTarget,
    setDisableTarget,
  ] = useState(null);

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    roleFilter,
    setRoleFilter,
  ] = useState("all");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [loading, setLoading] =
    useState(true);

  const [loadError, setLoadError] =
    useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    disabling,
    setDisabling,
  ] = useState(false);

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const normaliseRole = (value) =>
    String(value || "worker")
      .trim()
      .toLowerCase();

  const normaliseStatus = (value) =>
    String(value || "active")
      .trim()
      .toLowerCase();

  const getStatusClass = (
    status
  ) =>
    normaliseStatus(status) ===
    "active"
      ? "badge green"
      : "badge yellow";

  const getRoleClass = (role) => {
    const value =
      normaliseRole(role);

    if (value === "admin") {
      return "badge red";
    }

    if (value === "manager") {
      return "badge blue";
    }

    if (
      value === "subcontractor"
    ) {
      return "badge yellow";
    }

    return "badge green";
  };

  const fetchUsers =
    useCallback(
      async ({
        showLoader = true,
      } = {}) => {
        try {
          if (showLoader) {
            setLoading(true);
          }

          setLoadError("");

          const response =
            await getUsers();

          const records =
            response?.users ||
            response?.data?.users ||
            response?.data ||
            [];

          setUsers(
            Array.isArray(records)
              ? records
              : []
          );
        } catch (error) {
          console.error(
            "Failed to load users:",
            error.response?.data ||
              error
          );

          const message =
            error.response?.data
              ?.message ||
            "Failed to load users.";

          setLoadError(message);

          if (!showLoader) {
            toast.error(message);
          }
        } finally {
          if (showLoader) {
            setLoading(false);
          }
        }
      },
      []
    );

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const totals = useMemo(() => {
    const active =
      users.filter(
        (portalUser) =>
          normaliseStatus(
            portalUser.status
          ) === "active"
      );

    const inactive =
      users.filter(
        (portalUser) =>
          normaliseStatus(
            portalUser.status
          ) === "inactive"
      );

    const admins =
      users.filter(
        (portalUser) =>
          normaliseRole(
            portalUser.role
          ) === "admin"
      );

    const managers =
      users.filter(
        (portalUser) =>
          normaliseRole(
            portalUser.role
          ) === "manager"
      );

    const workers =
      users.filter(
        (portalUser) =>
          normaliseRole(
            portalUser.role
          ) === "worker"
      );

    const subcontractors =
      users.filter(
        (portalUser) =>
          normaliseRole(
            portalUser.role
          ) ===
          "subcontractor"
      );

    return {
      active: active.length,
      inactive:
        inactive.length,
      admins: admins.length,
      managers:
        managers.length,
      workers: workers.length,
      subcontractors:
        subcontractors.length,
    };
  }, [users]);

  const filteredUsers =
    useMemo(() => {
      const search =
        searchTerm
          .trim()
          .toLowerCase();

      return users.filter(
        (portalUser) => {
          const role =
            normaliseRole(
              portalUser.role
            );

          const status =
            normaliseStatus(
              portalUser.status
            );

          const matchesRole =
            roleFilter === "all" ||
            role === roleFilter;

          const matchesStatus =
            statusFilter === "all" ||
            status ===
              statusFilter;

          const searchableText = [
            portalUser.full_name,
            portalUser.email,
            role,
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
            matchesRole &&
            matchesStatus &&
            matchesSearch
          );
        }
      );
    }, [
      users,
      searchTerm,
      roleFilter,
      statusFilter,
    ]);

  const userExportColumns = [
    {
      key: "full_name",
      label: "Name",
    },
    {
      key: "email",
      label: "Email",
    },
    {
      key: "role",
      label: "Role",
    },
    {
      key: "status",
      label: "Status",
    },
  ];

  const userExportRows =
    filteredUsers.map(
      (portalUser) => ({
        full_name:
          portalUser.full_name ||
          "",
        email:
          portalUser.email || "",
        role:
          normaliseRole(
            portalUser.role
          ),
        status:
          normaliseStatus(
            portalUser.status
          ),
      })
    );

  const userExportSummary = {
    "Total Users":
      users.length,
    "Active Users":
      totals.active,
    "Inactive Users":
      totals.inactive,
    Administrators:
      totals.admins,
    Managers:
      totals.managers,
    Workers:
      totals.workers,
    Subcontractors:
      totals.subcontractors,
    "Filtered Records":
      filteredUsers.length,
  };

  const handleChange = (
    event
  ) => {
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
    setEditingUser(null);
    setShowPassword(false);
  };

  const startEdit = (
    portalUser
  ) => {
    if (
      submitting ||
      disabling
    ) {
      return;
    }

    setEditingUser(
      portalUser
    );

    setSelectedUser(
      portalUser
    );

    setFormData({
      full_name:
        portalUser.full_name ||
        "",
      email:
        portalUser.email || "",
      password: "",
      role:
        normaliseRole(
          portalUser.role
        ),
      status:
        normaliseStatus(
          portalUser.status
        ),
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const validateUser = ({
    full_name,
    email,
    password,
    role,
    status,
  }) => {
    if (!full_name) {
      toast.error(
        "Full name is required."
      );
      return false;
    }

    if (!email) {
      toast.error(
        "Email address is required."
      );
      return false;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
      )
    ) {
      toast.error(
        "Enter a valid email address."
      );
      return false;
    }

    if (
      !editingUser &&
      String(password || "")
        .length < 8
    ) {
      toast.error(
        "Temporary password must contain at least 8 characters."
      );
      return false;
    }

    if (
      !ALLOWED_ROLES.includes(
        role
      )
    ) {
      toast.error(
        "Select a valid user role."
      );
      return false;
    }

    if (
      editingUser &&
      !ALLOWED_STATUSES.includes(
        status
      )
    ) {
      toast.error(
        "Select a valid account status."
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

      email:
        formData.email
          .trim()
          .toLowerCase(),

      password:
        formData.password,

      role:
        normaliseRole(
          formData.role
        ),

      status:
        normaliseStatus(
          formData.status
        ),
    };

    if (
      !validateUser(payload)
    ) {
      return;
    }

    try {
      setSubmitting(true);

      if (editingUser) {
        await updateUser(
          editingUser.id,
          {
            full_name:
              payload.full_name,
            email:
              payload.email,
            role:
              payload.role,
            status:
              payload.status,
          }
        );

        toast.success(
          "User updated successfully."
        );
      } else {
        await createUser({
          full_name:
            payload.full_name,
          email:
            payload.email,
          password:
            payload.password,
          role:
            payload.role,
        });

        toast.success(
          "User created successfully."
        );
      }

      resetForm();

      await fetchUsers({
        showLoader: false,
      });
    } catch (error) {
      console.error(
        "Failed to save user:",
        error.response?.data ||
          error
      );

      toast.error(
        error.response?.data
          ?.message ||
          "Failed to save user."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const requestDisable = (
    portalUser
  ) => {
    if (
      submitting ||
      disabling
    ) {
      return;
    }

    if (
      Number(portalUser.id) ===
      Number(currentUser?.id)
    ) {
      toast.error(
        "You cannot disable your own account."
      );
      return;
    }

    if (
      normaliseStatus(
        portalUser.status
      ) === "inactive"
    ) {
      return;
    }

    setDisableTarget(
      portalUser
    );
  };

  const handleConfirmDisable =
    async () => {
      if (
        !disableTarget ||
        disabling
      ) {
        return;
      }

      if (
        Number(
          disableTarget.id
        ) ===
        Number(currentUser?.id)
      ) {
        setDisableTarget(null);

        toast.error(
          "You cannot disable your own account."
        );
        return;
      }

      try {
        setDisabling(true);

        await disableUser(
          disableTarget.id
        );

        if (
          selectedUser?.id ===
          disableTarget.id
        ) {
          setSelectedUser(
            (previousUser) =>
              previousUser
                ? {
                    ...previousUser,
                    status:
                      "inactive",
                  }
                : null
          );
        }

        if (
          editingUser?.id ===
          disableTarget.id
        ) {
          resetForm();
        }

        setDisableTarget(null);

        await fetchUsers({
          showLoader: false,
        });

        toast.success(
          "User disabled successfully."
        );
      } catch (error) {
        console.error(
          "Failed to disable user:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            "Failed to disable user."
        );
      } finally {
        setDisabling(false);
      }
    };

  const resetFilters = () => {
    setSearchTerm("");
    setRoleFilter("all");
    setStatusFilter("all");
  };

  const isBusy =
    submitting ||
    disabling;

  if (loading) {
    return (
      <section className="panel">
        <h2>
          Loading users...
        </h2>

        <p className="muted-text">
          Loading portal accounts,
          roles and access status.
        </p>
      </section>
    );
  }

  if (
    loadError &&
    users.length === 0
  ) {
    return (
      <section className="panel">
        <h2>
          Users could not be loaded
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
            fetchUsers()
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
              fetchUsers()
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
              User Management
            </h2>

            <p className="muted-text">
              Create accounts, assign
              portal roles and control
              account access.
            </p>
          </div>

          <ExportButtons
            filename="users"
            title="Users Report"
            subtitle="Construction Portal user and access register"
            rows={userExportRows}
            columns={
              userExportColumns
            }
            summary={
              userExportSummary
            }
          />
        </div>
      </section>

      <section className="summary-cards">
        <div className="card">
          <p>Total Users</p>
          <h2>
            {users.length}
          </h2>
        </div>

        <div className="card highlight-success">
          <p>Active Users</p>
          <h2>
            {totals.active}
          </h2>
        </div>

        <div className="card highlight-warning">
          <p>Inactive Users</p>
          <h2>
            {totals.inactive}
          </h2>
        </div>

        <div className="card highlight-danger">
          <p>Administrators</p>
          <h2>
            {totals.admins}
          </h2>
        </div>

        <div className="card">
          <p>Managers</p>
          <h2>
            {totals.managers}
          </h2>
        </div>

        <div className="card">
          <p>Workers</p>
          <h2>
            {totals.workers}
          </h2>
        </div>

        <div className="card">
          <p>Subcontractors</p>
          <h2>
            {
              totals.subcontractors
            }
          </h2>
        </div>

        <div className="card">
          <p>Filtered Records</p>
          <h2>
            {
              filteredUsers.length
            }
          </h2>
        </div>
      </section>

      <section className="payment-grid">
        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                {editingUser
                  ? "Edit User"
                  : "Create User"}
              </h2>

              <p className="muted-text">
                {editingUser
                  ? "Update account identity, role and access status."
                  : "Create a portal login for an administrator, manager, worker or subcontractor."}
              </p>
            </div>
          </div>

          <form
            className="payment-form"
            onSubmit={
              handleSubmit
            }
          >
            <div className="form-section-title">
              <h3>
                Account Information
              </h3>

              <p className="muted-text">
                Enter the user identity
                and portal login
                details.
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
                Email Address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={
                    formData.email
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

              {!editingUser && (
                <label>
                  Temporary Password

                  <div className="password-input-wrapper">
                    <input
                      name="password"
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      autoComplete="new-password"
                      value={
                        formData.password
                      }
                      onChange={
                        handleChange
                      }
                      disabled={
                        submitting
                      }
                      minLength={8}
                      required
                    />

                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() =>
                        setShowPassword(
                          (previous) =>
                            !previous
                        )
                      }
                      disabled={
                        submitting
                      }
                      aria-label={
                        showPassword
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      {showPassword
                        ? "Hide"
                        : "Show"}
                    </button>
                  </div>
                </label>
              )}

              <label>
                User Role
                <select
                  name="role"
                  value={
                    formData.role
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    submitting
                  }
                  required
                >
                  <option value="admin">
                    Administrator
                  </option>

                  <option value="manager">
                    Manager
                  </option>

                  <option value="worker">
                    Worker
                  </option>

                  <option value="subcontractor">
                    Subcontractor
                  </option>
                </select>
              </label>

              {editingUser && (
                <label>
                  Account Status
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
              )}
            </div>

            {!editingUser && (
              <small className="muted-text">
                The temporary password
                is only used when
                creating the account.
                Password changes are
                handled through account
                settings or password
                recovery.
              </small>
            )}

            <div className="form-preview-total">
              Account Preview:{" "}
              {formData.full_name ||
                "New User"}{" "}
              ·{" "}
              {formData.email ||
                "No email"}{" "}
              · {formData.role}
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
                  : editingUser
                    ? "Save Changes"
                    : "Create User"}
              </button>

              {editingUser && (
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
                User Filters
              </h2>

              <p className="muted-text">
                Search accounts and
                filter by role or access
                status.
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
              placeholder="Search name, email, role or status..."
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(
                  event.target.value
                )
              }
              disabled={isBusy}
            />
          </label>

          <div className="form-grid">
            <label>
              Role
              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(
                    event.target.value
                  )
                }
                disabled={isBusy}
              >
                <option value="all">
                  All Roles
                </option>

                <option value="admin">
                  Administrators
                </option>

                <option value="manager">
                  Managers
                </option>

                <option value="worker">
                  Workers
                </option>

                <option value="subcontractor">
                  Subcontractors
                </option>
              </select>
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
          </div>

          <table>
            <tbody>
              <tr>
                <td>
                  Role Filter
                </td>
                <td>
                  {roleFilter}
                </td>
              </tr>

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
                  Matching Users
                </td>
                <td className="number-cell">
                  {
                    filteredUsers.length
                  }
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </section>

      {selectedUser && (
        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>User Preview</h2>

              <p className="muted-text">
                Account identity, role
                and current access
                state.
              </p>
            </div>

            <button
              type="button"
              className="secondary-btn"
              onClick={() =>
                setSelectedUser(null)
              }
              disabled={disabling}
            >
              Close Preview
            </button>
          </div>

          <section className="summary-cards">
            <div className="card">
              <p>Name</p>
              <h2>
                {selectedUser.full_name ||
                  "-"}
              </h2>
            </div>

            <div className="card">
              <p>Email</p>
              <h2>
                {selectedUser.email ||
                  "-"}
              </h2>
            </div>

            <div className="card">
              <p>Role</p>

              <h2>
                <span
                  className={getRoleClass(
                    selectedUser.role
                  )}
                >
                  {normaliseRole(
                    selectedUser.role
                  )}
                </span>
              </h2>
            </div>

            <div className="card">
              <p>Status</p>

              <h2>
                <span
                  className={getStatusClass(
                    selectedUser.status
                  )}
                >
                  {normaliseStatus(
                    selectedUser.status
                  )}
                </span>
              </h2>
            </div>
          </section>
        </section>
      )}

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              Users Register
            </h2>

            <p className="muted-text">
              {filteredUsers.length}{" "}
              matching user
              {filteredUsers.length ===
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
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map(
                (portalUser) => {
                  const isCurrentUser =
                    Number(
                      portalUser.id
                    ) ===
                    Number(
                      currentUser?.id
                    );

                  const isInactive =
                    normaliseStatus(
                      portalUser.status
                    ) === "inactive";

                  return (
                    <tr
                      key={
                        portalUser.id
                      }
                    >
                      <td>
                        <button
                          type="button"
                          className="table-link-button"
                          onClick={() =>
                            setSelectedUser(
                              portalUser
                            )
                          }
                          disabled={
                            isBusy
                          }
                        >
                          {portalUser.full_name ||
                            "-"}

                          {isCurrentUser
                            ? " (You)"
                            : ""}
                        </button>
                      </td>

                      <td>
                        {portalUser.email ||
                          "-"}
                      </td>

                      <td>
                        <span
                          className={getRoleClass(
                            portalUser.role
                          )}
                        >
                          {normaliseRole(
                            portalUser.role
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                          className={getStatusClass(
                            portalUser.status
                          )}
                        >
                          {normaliseStatus(
                            portalUser.status
                          )}
                        </span>
                      </td>

                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            onClick={() =>
                              startEdit(
                                portalUser
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
                              setSelectedUser(
                                portalUser
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
                            disabled={
                              isInactive ||
                              isCurrentUser ||
                              isBusy
                            }
                            onClick={() =>
                              requestDisable(
                                portalUser
                              )
                            }
                          >
                            {isInactive
                              ? "Disabled"
                              : isCurrentUser
                                ? "Current User"
                                : "Disable"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }
              )}

              {filteredUsers.length ===
                0 && (
                <tr>
                  <td
                    colSpan="5"
                    className="empty-table-message"
                  >
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <DeleteVerificationModal
        open={Boolean(
          disableTarget
        )}
        itemName={
          disableTarget?.full_name ||
          "user"
        }
        onCancel={() => {
          if (!disabling) {
            setDisableTarget(null);
          }
        }}
        onConfirm={
          handleConfirmDisable
        }
        loading={disabling}
      />
    </>
  );
}

export default UsersPage;