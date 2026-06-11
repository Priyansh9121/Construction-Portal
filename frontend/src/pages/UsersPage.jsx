import { useEffect, useState } from "react";
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
  const [searchTerm, setSearchTerm] = useState("");

  const fetchUsers = async () => {
    const data = await getUsers();
    setUsers(data.users || []);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter((user) => {
    const search = searchTerm.toLowerCase();

    return (
      user.full_name?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search) ||
      user.role?.toLowerCase().includes(search) ||
      user.status?.toLowerCase().includes(search)
    );
  });

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingUser(null);
  };

  const startEdit = (user) => {
    setEditingUser(user);

    setFormData({
      full_name: user.full_name || "",
      email: user.email || "",
      password: "",
      role: user.role || "worker",
      status: user.status || "active",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (editingUser) {
      await updateUser(editingUser.id, {
        full_name: formData.full_name,
        email: formData.email,
        role: formData.role,
        status: formData.status,
      });
    } else {
      await createUser({
        full_name: formData.full_name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });
    }

    resetForm();
    fetchUsers();
  };

  const handleDisable = async (id) => {
    await disableUser(id);
    fetchUsers();
  };

  return (
    <section className="payment-grid">
      <div className="panel">
        <h2>{editingUser ? "Edit User" : "Create User"}</h2>

        <form className="payment-form" onSubmit={handleSubmit}>
          <input
            name="full_name"
            placeholder="Full Name"
            value={formData.full_name}
            onChange={handleChange}
            required
          />

          <input
            name="email"
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
          />

          {!editingUser && (
            <input
              name="password"
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          )}

          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            required
          >
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="worker">Worker</option>
            <option value="subcontractor">Subcontractor</option>
          </select>

          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            required
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button type="submit">
            {editingUser ? "Save Changes" : "Create User"}
          </button>

          {editingUser && (
            <button type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </form>
      </div>

      <div className="panel">
        <h2>Users List</h2>

        <input
          className="search-input"
          type="text"
          placeholder="Search users by name, email, role or status..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

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
                <td>{user.full_name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.status}</td>
                <td>
                  <button type="button" onClick={() => startEdit(user)}>
                    Edit
                  </button>

                  <button
                    type="button"
                    className="delete-btn"
                    onClick={() => handleDisable(user.id)}
                  >
                    Disable
                  </button>
                </td>
              </tr>
            ))}

            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan="5">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default UsersPage;