import { useMemo, useState } from "react";
import toast from "react-hot-toast";

function WorkerMoneyPage({
  workers = [],
  allocations = [],
  expenses = [],
  addAllocation,
  addExpense,
  fetchAllocations,
  fetchExpenses,
  updateAllocation,
  deleteAllocation,
  updateExpense,
  deleteExpense,
  approveExpense,
  rejectExpense,
}) {
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const money = (value) => `$${Number(value || 0).toFixed(2)}`;

  const allocationSummary = useMemo(() => {
    return allocations.map((allocation) => {
      const relatedExpenses = expenses.filter(
        (expense) =>
          Number(expense.allocation_id) === Number(allocation.id) &&
          expense.approval_status !== "rejected"
      );

      const totalSpent = relatedExpenses.reduce(
        (sum, expense) => sum + Number(expense.expense_amount || 0),
        0
      );

      return {
        ...allocation,
        totalSpent,
        remainingBalance: Number(allocation.allocated_amount || 0) - totalSpent,
      };
    });
  }, [allocations, expenses]);

  const filteredAllocations = allocationSummary.filter((item) => {
    const value = search.toLowerCase();

    return (
      item.worker_name?.toLowerCase().includes(value) ||
      item.purpose?.toLowerCase().includes(value) ||
      item.approval_status?.toLowerCase().includes(value)
    );
  });

  const filteredExpenses = expenses.filter((item) => {
    const value = search.toLowerCase();

    return (
      item.worker_name?.toLowerCase().includes(value) ||
      item.expense_description?.toLowerCase().includes(value) ||
      item.approval_status?.toLowerCase().includes(value)
    );
  });

  const handleApproveExpense = async (expense) => {
    await approveExpense(expense.id, "Approved from admin worker money page.");
    toast.success("Expense approved.");
    toast.error(error.response?.data?.message || "Something went wrong");
    await fetchExpenses();
    await fetchAllocations();
  };

  const handleRejectExpense = async (expense) => {
    await rejectExpense(expense.id, "Rejected from admin worker money page.");
    setMessage("Expense rejected.");
    await fetchExpenses();
    await fetchAllocations();
  };

  const handleDeleteAllocation = async (id) => {
    if (!confirm("Delete this allocation?")) return;

    await deleteAllocation(id);
    setMessage("Allocation deleted.");
    await fetchAllocations();
  };

  const handleDeleteExpense = async (id) => {
    if (!confirm("Delete this expense?")) return;

    await deleteExpense(id);
    setMessage("Expense deleted.");
    await fetchExpenses();
  };

  const pendingExpenses = expenses.filter(
    (expense) => expense.approval_status === "pending"
  );

  return (
    <>
      {message && <p className="success-message">{message}</p>}

      <section className="cards">
        <div className="card">
          <p>Total Allocations</p>
          <h2>{allocations.length}</h2>
        </div>

        <div className="card">
          <p>Total Expenses</p>
          <h2>{expenses.length}</h2>
        </div>

        <div className="card">
          <p>Pending Approvals</p>
          <h2>{pendingExpenses.length}</h2>
        </div>

        <div className="card">
          <p>Total Allocated</p>
          <h2>
            {money(
              allocations.reduce(
                (sum, item) => sum + Number(item.allocated_amount || 0),
                0
              )
            )}
          </h2>
        </div>
      </section>

      <section className="payment-grid">
        <div className="panel">
          <h2>Allocate Money to Worker</h2>

          <form className="payment-form" onSubmit={addAllocation}>
            <select name="worker_id" required>
              <option value="">Select Worker</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.full_name}
                </option>
              ))}
            </select>

            <input
              name="allocated_amount"
              type="number"
              placeholder="Allocated Amount"
              required
            />

            <textarea name="purpose" placeholder="Purpose" />

            <button type="submit">Allocate Money</button>
          </form>
        </div>

        <div className="panel">
          <h2>Add Worker Expense</h2>

          <form className="payment-form" onSubmit={addExpense}>
            <select name="allocation_id" required>
              <option value="">Select Allocation</option>
              {allocations.map((allocation) => (
                <option key={allocation.id} value={allocation.id}>
                  {allocation.worker_name} - {money(allocation.allocated_amount)}
                </option>
              ))}
            </select>

            <input
              name="expense_amount"
              type="number"
              placeholder="Expense Amount"
              required
            />

            <input name="expense_date" type="date" required />

            <textarea
              name="expense_description"
              placeholder="Expense Description"
            />

            <button type="submit">Add Expense</button>
          </form>
        </div>
      </section>

      <section className="panel">
        <h2>Search Worker Money</h2>

        <input
          className="search-input"
          placeholder="Search worker, purpose, status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </section>

      <section className="panel">
        <h2>Pending Expense Approvals</h2>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Receipt</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {pendingExpenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{expense.worker_name}</td>
                  <td>{expense.expense_date?.slice(0, 10)}</td>
                  <td>{money(expense.expense_amount)}</td>
                  <td>{expense.expense_description}</td>
                  <td>
                    {expense.uploaded_photo ? (
                      <a href={expense.uploaded_photo} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <button type="button" onClick={() => handleApproveExpense(expense)}>
                      Approve
                    </button>

                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => handleRejectExpense(expense)}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}

              {pendingExpenses.length === 0 && (
                <tr>
                  <td colSpan="6">No pending expenses.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Allocation Summary</h2>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th>Allocated</th>
                <th>Total Spent</th>
                <th>Remaining</th>
                <th>Status</th>
                <th>Purpose</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredAllocations.map((allocation) => (
                <tr key={allocation.id}>
                  <td>{allocation.worker_name}</td>
                  <td>{money(allocation.allocated_amount)}</td>
                  <td>{money(allocation.totalSpent)}</td>
                  <td>{money(allocation.remainingBalance)}</td>
                  <td>{allocation.approval_status}</td>
                  <td>{allocation.purpose}</td>
                  <td>{allocation.created_at?.slice(0, 10)}</td>
                  <td>
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => handleDeleteAllocation(allocation.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {filteredAllocations.length === 0 && (
                <tr>
                  <td colSpan="8">No allocations found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>All Worker Expenses</h2>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Remaining</th>
                <th>Description</th>
                <th>Status</th>
                <th>Receipt</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredExpenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{expense.worker_name}</td>
                  <td>{expense.expense_date?.slice(0, 10)}</td>
                  <td>{money(expense.expense_amount)}</td>
                  <td>{money(expense.remaining_balance)}</td>
                  <td>{expense.expense_description}</td>
                  <td>{expense.approval_status}</td>
                  <td>
                    {expense.uploaded_photo ? (
                      <a href={expense.uploaded_photo} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => handleDeleteExpense(expense.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan="8">No expenses found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default WorkerMoneyPage;