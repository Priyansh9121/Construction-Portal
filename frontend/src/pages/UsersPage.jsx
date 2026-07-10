import { useEffect, useMemo, useState } from "react";
import DeleteVerificationModal from "../components/DeleteVerificationModal";
import ExportButtons from "../components/export/ExportButtons";

import {
  getUsers,
  createUser,
  updateUser,
  disableUser,
} from "../services/userService";

function UsersPage() {
  const emptyForm = {
    full_name: "",
    email: "",
    password: "",
    role: "worker",
    status: "active",
  };

  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [disableTarget, setDisableTarget] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const normaliseRole = (value) =>
    String(value || "worker").trim().toLowerCase();

  const normaliseStatus = (value) =>
    String(value || "active").trim().toLowerCase();

  const getStatusClass = (status) =>
    normaliseStatus(status) === "active"
      ? "badge green"
      : "badge yellow";

  const getRoleClass = (role) => {
    const value = normaliseRole(role);

    if (value === "admin") return "badge red";
    if (value === "manager") return "badge blue";
    if (value === "subcontractor") return "badge yellow";

    return "badge green";
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getUsers();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const totals = useMemo(() => {
    const active = users.filter(
      (user) => normaliseStatus(user.status) === "active"
    );

    const inactive = users.filter(
      (user) => normaliseStatus(user.status) === "inactive"
    );

    const admins = users.filter(
      (user) => normaliseRole(user.role) === "admin"
    );

    const managers = users.filter(
      (user) => normaliseRole(user.role) === "manager"
    );

    const workers = users.filter(
      (user) => normaliseRole(user.role) === "worker"
    );

    const subcontractors = users.filter(
      (user) => normaliseRole(user.role) === "subcontractor"
    );

    return {
      active: active.length,
      inactive: inactive.length,
      admins: admins.length,
      managers: managers.length,
      workers: workers.length,
      subcontractors: subcontractors.length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      const role = normaliseRole(user.role);
      const status = normaliseStatus(user.status);

      const matchesRole =
        roleFilter === "all" || role === roleFilter;

      const matchesStatus =
        statusFilter === "all" || status === statusFilter;

      const matchesSearch =
        !search ||
        user.full_name?.toLowerCase().includes(search) ||
        user.email?.toLowerCase().includes(search) ||
        role.includes(search) ||
        status.includes(search);

      return matchesRole && matchesStatus && matchesSearch;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const userExportColumns = [
    { key: "full_name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "role", label: "Role" },
    { key: "status", label: "Status" },
  ];

  const userExportRows = filteredUsers.map((user) => ({
    full_name: user.full_name || "",
    email: user.email || "",
    role: normaliseRole(user.role),
    status: normaliseStatus(user.status),
  }));

  const userExportSummary = {
    "Total Users": users.length,
    "Active Users": totals.active,
    "Inactive Users": totals.inactive,
    Administrators: totals.admins,
    Managers: totals.managers,
    Workers: totals.workers,
    Subcontractors: totals.subcontractors,
    "Filtered Records": filteredUsers.length,
  };

  const handleChange = (event) => {
    setFormData((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingUser(null);
  };

  const startEdit = (user) => {
    setEditingUser(user);
    setSelectedUser(user);

    setFormData({
      full_name: user.full_name || "",
      email: user.email || "",
      password: "",
      role: normaliseRole(user.role),
      status: normaliseStatus(user.status),
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    try {
      setSubmitting(true);
      setMessage("");
      setError("");

      if (editingUser) {
        await updateUser(editingUser.id, {
          full_name: formData.full_name.trim(),
          email: formData.email.trim(),
          role: formData.role,
          status: formData.status,
        });

        setMessage("User updated successfully.");
      } else {
        await createUser({
          full_name: formData.full_name.trim(),
          email: formData.email.trim(),
          password: formData.password,
          role: formData.role,
        });

        setMessage("User created successfully.");
      }

      resetForm();
      await fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save user.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDisable = async () => {
    if (!disableTarget) return;

    try {
      setMessage("");
      setError("");

      await disableUser(disableTarget.id);

      if (selectedUser?.id === disableTarget.id) {
        setSelectedUser((prev) =>
          prev
            ? {
                ...prev,
                status: "inactive",
              }
            : null
        );
      }

      if (editingUser?.id === disableTarget.id) {
        resetForm();
      }

      setDisableTarget(null);
      setMessage("User disabled successfully.");

      await fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to disable user.");
    }
  };

  const resetFilters = () => {
    setSearchTerm("");
    setRoleFilter("all");
    setStatusFilter("all");
  };

  if (loading) {
    return <div className="panel">Loading users...</div>;
  }

  return (
    <>
      {message && <p className="success-message">{message}</p>}
      {error && <p className="error">{error}</p>}

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>User Management</h2>

            <p className="muted-text">
              Create accounts, assign portal roles and control account access.
            </p>
          </div>

          <ExportButtons
            filename="users"
            title="Users Report"
            subtitle="Construction Portal user and access register"
            rows={userExportRows}
            columns={userExportColumns}
            summary={userExportSummary}
          />
        </div>
      </section>

      <section className="summary-cards">
        <div className="card">
          <p>Total Users</p>
          <h2>{users.length}</h2>
        </div>

        <div className="card highlight-success">
          <p>Active Users</p>
          <h2>{totals.active}</h2>
        </div>

        <div className="card highlight-warning">
          <p>Inactive Users</p>
          <h2>{totals.inactive}</h2>
        </div>

        <div className="card highlight-danger">
          <p>Administrators</p>
          <h2>{totals.admins}</h2>
        </div>

        <div className="card">
          <p>Managers</p>
          <h2>{totals.managers}</h2>
        </div>

        <div className="card">
          <p>Workers</p>
          <h2>{totals.workers}</h2>
        </div>

        <div className="card">
          <p>Subcontractors</p>
          <h2>{totals.subcontractors}</h2>
        </div>

        <div className="card">
          <p>Filtered Records</p>
          <h2>{filteredUsers.length}</h2>
        </div>
      </section>

      <section className="payment-grid">
        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>{editingUser ? "Edit User" : "Create User"}</h2>

              <p className="muted-text">
                {editingUser
                  ? "Update account identity, role and access status."
                  : "Create a portal login for an administrator, manager, worker or subcontractor."}
              </p>
            </div>
          </div>

          <form className="payment-form" onSubmit={handleSubmit}>
            <div className="form-section-title">
              <h3>Account Information</h3>
              <p className="muted-text">
                Enter the user identity and portal login details.
              </p>
            </div>

            <div className="form-grid">
              <label>
                Full Name
                <input
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Email Address
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </label>

              {!editingUser && (
                <label>
                  Temporary Password
                  <input
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    minLength="6"
                    required
                  />
                </label>
              )}

              <label>
                User Role
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                >
                  <option value="admin">Administrator</option>
                  <option value="manager">Manager</option>
                  <option value="worker">Worker</option>
                  <option value="subcontractor">Subcontractor</option>
                </select>
              </label>

              {editingUser && (
                <label>
                  Account Status
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    required
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              )}
            </div>

            {!editingUser && (
              <small>
                The password is only used when creating the account. Password
                changes are handled through the password reset or account
                settings workflow.
              </small>
            )}

            <div className="form-preview-total">
              Account Preview: {formData.full_name || "New User"} ·{" "}
              {formData.email || "No email"} · {formData.role}
            </div>

            <div className="form-actions">
              <button type="submit" disabled={submitting}>
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
                  onClick={resetForm}
                  disabled={submitting}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>User Filters</h2>

              <p className="muted-text">
                Search accounts and filter by role or access status.
              </p>
            </div>

            <button
              type="button"
              className="secondary-btn"
              onClick={resetFilters}
            >
              Reset
            </button>
          </div>

          <label>
            Search
            <input
              className="search-input"
              type="text"
              placeholder="Search name, email, role or status..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>

          <div className="form-grid">
            <label>
              Role
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="admin">Administrators</option>
                <option value="manager">Managers</option>
                <option value="worker">Workers</option>
                <option value="subcontractor">Subcontractors</option>
              </select>
            </label>

            <label>
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>

          <table>
            <tbody>
              <tr>
                <td>Role Filter</td>
                <td>{roleFilter}</td>
              </tr>

              <tr>
                <td>Status Filter</td>
                <td>{statusFilter}</td>
              </tr>

              <tr>
                <td>Matching Users</td>
                <td className="number-cell">{filteredUsers.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {selectedUser && (
        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>User Preview</h2>

              <p className="muted-text">
                Account identity, role and current access state.
              </p>
            </div>

            <button
              type="button"
              className="secondary-btn"
              onClick={() => setSelectedUser(null)}
            >
              Close Preview
            </button>
          </div>

          <section className="summary-cards">
            <div className="card">
              <p>Name</p>
              <h2>{selectedUser.full_name || "-"}</h2>
            </div>

            <div className="card">
              <p>Email</p>
              <h2>{selectedUser.email || "-"}</h2>
            </div>

            <div className="card">
              <p>Role</p>
              <h2>
                <span className={getRoleClass(selectedUser.role)}>
                  {normaliseRole(selectedUser.role)}
                </span>
              </h2>
            </div>

            <div className="card">
              <p>Status</p>
              <h2>
                <span className={getStatusClass(selectedUser.status)}>
                  {normaliseStatus(selectedUser.status)}
                </span>
              </h2>
            </div>
          </section>
        </section>
      )}

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Users Register</h2>

            <p className="muted-text">
              {filteredUsers.length} matching user
              {filteredUsers.length === 1 ? "" : "s"}.
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
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <button
                      type="button"
                      className="table-link-button"
                      onClick={() => setSelectedUser(user)}
                    >
                      {user.full_name || "-"}
                    </button>
                  </td>

                  <td>{user.email || "-"}</td>

                  <td>
                    <span className={getRoleClass(user.role)}>
                      {normaliseRole(user.role)}
                    </span>
                  </td>

                  <td>
                    <span className={getStatusClass(user.status)}>
                      {normaliseStatus(user.status)}
                    </span>
                  </td>

                  <td>
                    <button type="button" onClick={() => startEdit(user)}>
                      Edit
                    </button>

                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => setSelectedUser(user)}
                    >
                      Preview
                    </button>

                    <button
                      type="button"
                      className="delete-btn"
                      disabled={normaliseStatus(user.status) === "inactive"}
                      onClick={() => setDisableTarget(user)}
                    >
                      {normaliseStatus(user.status) === "inactive"
                        ? "Disabled"
                        : "Disable"}
                    </button>
                  </td>
                </tr>
              ))}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="5" className="empty-table-message">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <DeleteVerificationModal
        open={!!disableTarget}
        itemName={disableTarget?.full_name || "user"}
        onCancel={() => setDisableTarget(null)}
        onConfirm={handleConfirmDisable}
      />
    </>
  );
}

export default UsersPage;