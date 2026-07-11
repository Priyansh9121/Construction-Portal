import {
  useMemo,
  useState,
} from "react";

import toast from "react-hot-toast";

import ExportButtons from "../components/export/ExportButtons";
import DeleteVerificationModal from "../components/DeleteVerificationModal";

import {
  formatCurrency,
} from "../utils/currency";

function WorkerMoneyPage({
  workers = [],
  allocations = [],
  expenses = [],
  addAllocation,
  addExpense,
  fetchAllocations,
  fetchExpenses,
  deleteAllocation,
  deleteExpense,
  approveExpense,
  rejectExpense,
}) {
  const [search, setSearch] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [
    activeView,
    setActiveView,
  ] = useState("allocations");

  const [
    processingKey,
    setProcessingKey,
  ] = useState(null);

  const [
    addingAllocation,
    setAddingAllocation,
  ] = useState(false);

  const [
    addingExpense,
    setAddingExpense,
  ] = useState(false);

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState(null);

  const money = formatCurrency;

  const dateOnly = (value) =>
    value
      ? String(value).slice(0, 10)
      : "-";

  const normaliseStatus = (value) =>
    String(value || "pending")
      .trim()
      .toLowerCase();

  const getStatusClass = (status) => {
    const value =
      normaliseStatus(status);

    if (
      value === "approved" ||
      value === "active"
    ) {
      return "badge green";
    }

    if (
      value === "rejected" ||
      value === "inactive"
    ) {
      return "badge red";
    }

    return "badge yellow";
  };

  const safeRefreshAllocations =
    async () => {
      if (
        typeof fetchAllocations ===
        "function"
      ) {
        await fetchAllocations();
      }
    };

  const safeRefreshExpenses =
    async () => {
      if (
        typeof fetchExpenses ===
        "function"
      ) {
        await fetchExpenses();
      }
    };

  const refreshWorkerMoney =
    async () => {
      await Promise.all([
        safeRefreshAllocations(),
        safeRefreshExpenses(),
      ]);
    };

  const allocationSummary =
    useMemo(() => {
      return allocations.map(
        (allocation) => {
          const relatedExpenses =
            expenses.filter(
              (expense) =>
                Number(
                  expense.allocation_id
                ) ===
                  Number(
                    allocation.id
                  ) &&
                normaliseStatus(
                  expense.approval_status
                ) !== "rejected"
            );

          const totalSpent =
            relatedExpenses.reduce(
              (sum, expense) =>
                sum +
                Number(
                  expense.expense_amount ||
                    0
                ),
              0
            );

          const allocatedAmount =
            Number(
              allocation.allocated_amount ||
                0
            );

          return {
            ...allocation,
            totalSpent,
            remainingBalance:
              allocatedAmount -
              totalSpent,
            expenseCount:
              relatedExpenses.length,
          };
        }
      );
    }, [
      allocations,
      expenses,
    ]);

  const totals = useMemo(() => {
    const totalAllocated =
      allocationSummary.reduce(
        (sum, item) =>
          sum +
          Number(
            item.allocated_amount ||
              0
          ),
        0
      );

    const totalSpent =
      allocationSummary.reduce(
        (sum, item) =>
          sum +
          Number(
            item.totalSpent || 0
          ),
        0
      );

    const totalRemaining =
      allocationSummary.reduce(
        (sum, item) =>
          sum +
          Number(
            item.remainingBalance ||
              0
          ),
        0
      );

    const approvedExpenses =
      expenses.filter(
        (item) =>
          normaliseStatus(
            item.approval_status
          ) === "approved"
      );

    const pendingExpenses =
      expenses.filter(
        (item) =>
          normaliseStatus(
            item.approval_status
          ) === "pending"
      );

    const rejectedExpenses =
      expenses.filter(
        (item) =>
          normaliseStatus(
            item.approval_status
          ) === "rejected"
      );

    return {
      totalAllocated,
      totalSpent,
      totalRemaining,

      approvedExpenseAmount:
        approvedExpenses.reduce(
          (sum, item) =>
            sum +
            Number(
              item.expense_amount ||
                0
            ),
          0
        ),

      pendingExpenseAmount:
        pendingExpenses.reduce(
          (sum, item) =>
            sum +
            Number(
              item.expense_amount ||
                0
            ),
          0
        ),

      rejectedExpenseAmount:
        rejectedExpenses.reduce(
          (sum, item) =>
            sum +
            Number(
              item.expense_amount ||
                0
            ),
          0
        ),

      approvedCount:
        approvedExpenses.length,

      pendingCount:
        pendingExpenses.length,

      rejectedCount:
        rejectedExpenses.length,
    };
  }, [
    allocationSummary,
    expenses,
  ]);

  const filteredAllocations =
    useMemo(() => {
      const value =
        search
          .trim()
          .toLowerCase();

      return allocationSummary.filter(
        (item) => {
          const status =
            normaliseStatus(
              item.approval_status
            );

          const matchesStatus =
            statusFilter === "all" ||
            status ===
              statusFilter;

          const searchableText = [
            item.worker_name,
            item.purpose,
            status,
            item.allocated_amount,
            item.totalSpent,
            item.remainingBalance,
            item.created_at,
          ]
            .filter(
              (entry) =>
                entry !== null &&
                entry !== undefined
            )
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !value ||
            searchableText.includes(
              value
            );

          return (
            matchesStatus &&
            matchesSearch
          );
        }
      );
    }, [
      allocationSummary,
      search,
      statusFilter,
    ]);

  const filteredExpenses =
    useMemo(() => {
      const value =
        search
          .trim()
          .toLowerCase();

      return expenses.filter(
        (item) => {
          const status =
            normaliseStatus(
              item.approval_status
            );

          const matchesStatus =
            statusFilter === "all" ||
            status ===
              statusFilter;

          const searchableText = [
            item.worker_name,
            item.expense_description,
            status,
            item.expense_amount,
            item.remaining_balance,
            item.expense_date,
          ]
            .filter(
              (entry) =>
                entry !== null &&
                entry !== undefined
            )
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !value ||
            searchableText.includes(
              value
            );

          return (
            matchesStatus &&
            matchesSearch
          );
        }
      );
    }, [
      expenses,
      search,
      statusFilter,
    ]);

  const pendingExpenses =
    useMemo(
      () =>
        expenses.filter(
          (expense) =>
            normaliseStatus(
              expense.approval_status
            ) === "pending"
        ),
      [expenses]
    );

  const activeWorkers =
    useMemo(
      () =>
        workers.filter(
          (worker) =>
            String(
              worker.status || ""
            )
              .trim()
              .toLowerCase() ===
            "active"
        ),
      [workers]
    );

  const filteredAllocationTotal =
    useMemo(
      () =>
        filteredAllocations.reduce(
          (sum, item) =>
            sum +
            Number(
              item.allocated_amount ||
                0
            ),
          0
        ),
      [filteredAllocations]
    );

  const filteredAllocationSpent =
    useMemo(
      () =>
        filteredAllocations.reduce(
          (sum, item) =>
            sum +
            Number(
              item.totalSpent || 0
            ),
          0
        ),
      [filteredAllocations]
    );

  const filteredAllocationRemaining =
    useMemo(
      () =>
        filteredAllocations.reduce(
          (sum, item) =>
            sum +
            Number(
              item.remainingBalance ||
                0
            ),
          0
        ),
      [filteredAllocations]
    );

  const filteredExpenseTotal =
    useMemo(
      () =>
        filteredExpenses.reduce(
          (sum, item) =>
            sum +
            Number(
              item.expense_amount ||
                0
            ),
          0
        ),
      [filteredExpenses]
    );

  const allocationExportColumns = [
    {
      key: "worker_name",
      label: "Worker",
    },
    {
      key: "allocated_amount",
      label: "Allocated",
    },
    {
      key: "total_spent",
      label: "Total Spent",
    },
    {
      key: "remaining_balance",
      label: "Remaining",
    },
    {
      key: "expense_count",
      label: "Expenses",
    },
    {
      key: "approval_status",
      label: "Status",
    },
    {
      key: "purpose",
      label: "Purpose",
    },
    {
      key: "created_at",
      label: "Date",
    },
  ];

  const allocationExportRows =
    filteredAllocations.map(
      (item) => ({
        worker_name:
          item.worker_name || "",

        allocated_amount:
          money(
            item.allocated_amount
          ),

        total_spent:
          money(
            item.totalSpent
          ),

        remaining_balance:
          money(
            item.remainingBalance
          ),

        expense_count:
          item.expenseCount || 0,

        approval_status:
          normaliseStatus(
            item.approval_status
          ),

        purpose:
          item.purpose || "",

        created_at:
          dateOnly(
            item.created_at
          ),
      })
    );

  const allocationExportSummary = {
    "Total Allocations":
      allocations.length,

    "Total Allocated":
      money(
        totals.totalAllocated
      ),

    "Total Spent":
      money(
        totals.totalSpent
      ),

    "Total Remaining":
      money(
        totals.totalRemaining
      ),

    "Filtered Allocations":
      filteredAllocations.length,

    "Filtered Allocated":
      money(
        filteredAllocationTotal
      ),

    "Filtered Spent":
      money(
        filteredAllocationSpent
      ),

    "Filtered Remaining":
      money(
        filteredAllocationRemaining
      ),
  };

  const expenseExportColumns = [
    {
      key: "worker_name",
      label: "Worker",
    },
    {
      key: "expense_date",
      label: "Date",
    },
    {
      key: "expense_amount",
      label: "Amount",
    },
    {
      key: "remaining_balance",
      label: "Remaining",
    },
    {
      key: "expense_description",
      label: "Description",
    },
    {
      key: "approval_status",
      label: "Status",
    },
    {
      key: "uploaded_photo",
      label: "Receipt",
    },
  ];

  const expenseExportRows =
    filteredExpenses.map(
      (item) => ({
        worker_name:
          item.worker_name || "",

        expense_date:
          dateOnly(
            item.expense_date
          ),

        expense_amount:
          money(
            item.expense_amount
          ),

        remaining_balance:
          money(
            item.remaining_balance
          ),

        expense_description:
          item.expense_description ||
          "",

        approval_status:
          normaliseStatus(
            item.approval_status
          ),

        uploaded_photo:
          item.uploaded_photo ||
          "",
      })
    );

  const expenseExportSummary = {
    "Total Expenses":
      expenses.length,

    "Approved Expenses":
      totals.approvedCount,

    "Approved Amount":
      money(
        totals.approvedExpenseAmount
      ),

    "Pending Expenses":
      totals.pendingCount,

    "Pending Amount":
      money(
        totals.pendingExpenseAmount
      ),

    "Rejected Expenses":
      totals.rejectedCount,

    "Rejected Amount":
      money(
        totals.rejectedExpenseAmount
      ),

    "Filtered Expenses":
      filteredExpenses.length,

    "Filtered Expense Value":
      money(
        filteredExpenseTotal
      ),
  };

  const handleAddAllocation =
    async (event) => {
      event.preventDefault();

      if (addingAllocation) {
        return;
      }

      if (
        typeof addAllocation !==
        "function"
      ) {
        toast.error(
          "Allocation function is unavailable."
        );
        return;
      }

      const form =
        event.currentTarget;

      const workerId =
        Number(
          form.worker_id.value
        );

      const amount =
        Number(
          form.allocated_amount
            .value || 0
        );

      if (!workerId) {
        toast.error(
          "Please select a worker."
        );
        return;
      }

      if (
        amount <= 0 ||
        Number.isNaN(amount)
      ) {
        toast.error(
          "Allocated amount must be greater than zero."
        );
        return;
      }

      try {
        setAddingAllocation(true);

        await addAllocation(
          event
        );

        toast.success(
          "Money allocated successfully."
        );

        await safeRefreshAllocations();
      } catch (error) {
        console.error(
          "Failed to add allocation:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            "Failed to allocate money."
        );
      } finally {
        setAddingAllocation(false);
      }
    };

  const handleAddExpense =
    async (event) => {
      event.preventDefault();

      if (addingExpense) {
        return;
      }

      if (
        typeof addExpense !==
        "function"
      ) {
        toast.error(
          "Expense function is unavailable."
        );
        return;
      }

      const form =
        event.currentTarget;

      const allocationId =
        Number(
          form.allocation_id.value
        );

      const amount =
        Number(
          form.expense_amount
            .value || 0
        );

      const selectedAllocation =
        allocationSummary.find(
          (allocation) =>
            Number(
              allocation.id
            ) === allocationId
        );

      if (!allocationId) {
        toast.error(
          "Please select an allocation."
        );
        return;
      }

      if (
        amount <= 0 ||
        Number.isNaN(amount)
      ) {
        toast.error(
          "Expense amount must be greater than zero."
        );
        return;
      }

      if (
        selectedAllocation &&
        amount >
          Number(
            selectedAllocation.remainingBalance ||
              0
          )
      ) {
        toast.error(
          "Expense amount exceeds the remaining allocation balance."
        );
        return;
      }

      try {
        setAddingExpense(true);

        await addExpense(event);

        toast.success(
          "Worker expense added successfully."
        );

        await refreshWorkerMoney();
      } catch (error) {
        console.error(
          "Failed to add expense:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            "Failed to add worker expense."
        );
      } finally {
        setAddingExpense(false);
      }
    };

  const handleApproveExpense =
    async (expense) => {
      const actionKey =
        `approve:${expense.id}`;

      if (processingKey) {
        return;
      }

      if (
        typeof approveExpense !==
        "function"
      ) {
        toast.error(
          "Expense approval function is unavailable."
        );
        return;
      }

      try {
        setProcessingKey(
          actionKey
        );

        await approveExpense(
          expense.id,
          "Approved from admin worker money page."
        );

        toast.success(
          "Expense approved successfully."
        );

        await refreshWorkerMoney();
      } catch (error) {
        console.error(
          "Failed to approve expense:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            "Failed to approve expense."
        );
      } finally {
        setProcessingKey(null);
      }
    };

  const handleRejectExpense =
    async (expense) => {
      const actionKey =
        `reject:${expense.id}`;

      if (processingKey) {
        return;
      }

      if (
        typeof rejectExpense !==
        "function"
      ) {
        toast.error(
          "Expense rejection function is unavailable."
        );
        return;
      }

      try {
        setProcessingKey(
          actionKey
        );

        await rejectExpense(
          expense.id,
          "Rejected from admin worker money page."
        );

        toast.success(
          "Expense rejected successfully."
        );

        await refreshWorkerMoney();
      } catch (error) {
        console.error(
          "Failed to reject expense:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            "Failed to reject expense."
        );
      } finally {
        setProcessingKey(null);
      }
    };

  const requestDeleteAllocation =
    (allocation) => {
      if (processingKey) {
        return;
      }

      setDeleteTarget({
        type: "allocation",
        item: allocation,
      });
    };

  const requestDeleteExpense =
    (expense) => {
      if (processingKey) {
        return;
      }

      setDeleteTarget({
        type: "expense",
        item: expense,
      });
    };

  const handleConfirmDelete =
    async () => {
      if (
        !deleteTarget ||
        processingKey
      ) {
        return;
      }

      const {
        type,
        item,
      } = deleteTarget;

      const actionKey =
        `delete:${type}:${item.id}`;

      try {
        setProcessingKey(
          actionKey
        );

        if (
          type === "allocation"
        ) {
          if (
            typeof deleteAllocation !==
            "function"
          ) {
            throw new Error(
              "Delete allocation function is unavailable."
            );
          }

          await deleteAllocation(
            item.id
          );

          await refreshWorkerMoney();

          toast.success(
            "Allocation deleted successfully."
          );
        } else if (
          type === "expense"
        ) {
          if (
            typeof deleteExpense !==
            "function"
          ) {
            throw new Error(
              "Delete expense function is unavailable."
            );
          }

          await deleteExpense(
            item.id
          );

          await refreshWorkerMoney();

          toast.success(
            "Expense deleted successfully."
          );
        } else {
          throw new Error(
            "Unsupported delete action."
          );
        }

        setDeleteTarget(null);
      } catch (error) {
        console.error(
          "Failed to delete worker money record:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            error.message ||
            "Failed to delete record."
        );
      } finally {
        setProcessingKey(null);
      }
    };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  const isBusy =
    addingAllocation ||
    addingExpense ||
    processingKey !== null;

  const isProcessing = (
    action,
    id
  ) =>
    processingKey ===
    `${action}:${id}`;

  return (
    <>
      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              Worker Money Management
            </h2>

            <p className="muted-text">
              Allocate funds, record
              worker expenses, monitor
              balances and process
              expense approvals.
            </p>
          </div>

          <ExportButtons
            filename={
              activeView ===
              "allocations"
                ? "worker-allocations"
                : "worker-expenses"
            }
            title={
              activeView ===
              "allocations"
                ? "Worker Allocations Report"
                : "Worker Expenses Report"
            }
            subtitle="Construction Portal worker money register"
            rows={
              activeView ===
              "allocations"
                ? allocationExportRows
                : expenseExportRows
            }
            columns={
              activeView ===
              "allocations"
                ? allocationExportColumns
                : expenseExportColumns
            }
            summary={
              activeView ===
              "allocations"
                ? allocationExportSummary
                : expenseExportSummary
            }
          />
        </div>
      </section>

      <section className="summary-cards">
        <div className="card">
          <p>Total Allocations</p>
          <h2>
            {allocations.length}
          </h2>
        </div>

        <div className="card highlight-success">
          <p>Total Allocated</p>
          <h2>
            {money(
              totals.totalAllocated
            )}
          </h2>
        </div>

        <div className="card highlight-danger">
          <p>Total Spent</p>
          <h2>
            {money(
              totals.totalSpent
            )}
          </h2>
        </div>

        <div
          className={
            totals.totalRemaining >= 0
              ? "card highlight-success"
              : "card highlight-danger"
          }
        >
          <p>Total Remaining</p>

          <h2>
            {money(
              totals.totalRemaining
            )}
          </h2>
        </div>

        <div className="card highlight-warning">
          <p>Pending Expenses</p>
          <h2>
            {totals.pendingCount}
          </h2>

          <small>
            {money(
              totals.pendingExpenseAmount
            )}
          </small>
        </div>

        <div className="card highlight-success">
          <p>Approved Expenses</p>
          <h2>
            {totals.approvedCount}
          </h2>

          <small>
            {money(
              totals.approvedExpenseAmount
            )}
          </small>
        </div>

        <div className="card highlight-danger">
          <p>Rejected Expenses</p>
          <h2>
            {totals.rejectedCount}
          </h2>

          <small>
            {money(
              totals.rejectedExpenseAmount
            )}
          </small>
        </div>

        <div className="card">
          <p>Active Workers</p>
          <h2>
            {activeWorkers.length}
          </h2>
        </div>
      </section>

      <section className="payment-grid">
        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                Allocate Money to Worker
              </h2>

              <p className="muted-text">
                Create a worker
                allocation for project
                purchases, travel,
                materials or
                operational expenses.
              </p>
            </div>
          </div>

          <form
            className="payment-form"
            onSubmit={
              handleAddAllocation
            }
          >
            <div className="form-grid">
              <label>
                Worker
                <select
                  name="worker_id"
                  required
                  defaultValue=""
                  disabled={
                    addingAllocation
                  }
                >
                  <option value="">
                    Select Worker
                  </option>

                  {activeWorkers.map(
                    (worker) => (
                      <option
                        key={
                          worker.id
                        }
                        value={
                          worker.id
                        }
                      >
                        {
                          worker.full_name
                        }

                        {worker.role
                          ? ` — ${worker.role}`
                          : ""}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Allocated Amount
                <input
                  name="allocated_amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  required
                  disabled={
                    addingAllocation
                  }
                />
              </label>
            </div>

            <label>
              Purpose
              <textarea
                name="purpose"
                placeholder="Explain what this allocation will be used for..."
                disabled={
                  addingAllocation
                }
              />
            </label>

            <button
              type="submit"
              disabled={
                addingAllocation
              }
            >
              {addingAllocation
                ? "Allocating..."
                : "Allocate Money"}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                Add Worker Expense
              </h2>

              <p className="muted-text">
                Record an expense
                against an existing
                worker allocation.
              </p>
            </div>
          </div>

          <form
            className="payment-form"
            onSubmit={
              handleAddExpense
            }
          >
            <label>
              Allocation
              <select
                name="allocation_id"
                required
                defaultValue=""
                disabled={
                  addingExpense
                }
              >
                <option value="">
                  Select Allocation
                </option>

                {allocationSummary
                  .filter(
                    (allocation) =>
                      Number(
                        allocation.remainingBalance ||
                          0
                      ) > 0
                  )
                  .map(
                    (allocation) => (
                      <option
                        key={
                          allocation.id
                        }
                        value={
                          allocation.id
                        }
                      >
                        {allocation.worker_name ||
                          "Worker"}{" "}
                        —{" "}
                        {money(
                          allocation.remainingBalance
                        )}{" "}
                        remaining
                      </option>
                    )
                  )}
              </select>
            </label>

            <div className="form-grid">
              <label>
                Expense Amount
                <input
                  name="expense_amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  required
                  disabled={
                    addingExpense
                  }
                />
              </label>

              <label>
                Expense Date
                <input
                  name="expense_date"
                  type="date"
                  max={new Date()
                    .toISOString()
                    .slice(0, 10)}
                  defaultValue={new Date()
                    .toISOString()
                    .slice(0, 10)}
                  required
                  disabled={
                    addingExpense
                  }
                />
              </label>
            </div>

            <label>
              Expense Description
              <textarea
                name="expense_description"
                placeholder="Describe the purchase or expense..."
                disabled={
                  addingExpense
                }
              />
            </label>

            <button
              type="submit"
              disabled={
                addingExpense
              }
            >
              {addingExpense
                ? "Adding..."
                : "Add Expense"}
            </button>
          </form>
        </section>
      </section>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              Search and Filters
            </h2>

            <p className="muted-text">
              Filter allocations and
              expenses by worker,
              purpose, amount or
              approval status.
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
            Reset Filters
          </button>
        </div>

        <div className="tabs">
          <button
            type="button"
            className={
              activeView ===
              "allocations"
                ? "active-tab"
                : ""
            }
            onClick={() =>
              setActiveView(
                "allocations"
              )
            }
            disabled={isBusy}
          >
            Allocations
          </button>

          <button
            type="button"
            className={
              activeView ===
              "expenses"
                ? "active-tab"
                : ""
            }
            onClick={() =>
              setActiveView(
                "expenses"
              )
            }
            disabled={isBusy}
          >
            Expenses
          </button>
        </div>

        <div className="form-grid">
          <label>
            Search
            <input
              className="search-input"
              type="search"
              placeholder="Search worker, purpose, description or amount..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              disabled={isBusy}
            />
          </label>

          <label>
            Approval Status
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

              <option value="pending">
                Pending
              </option>

              <option value="approved">
                Approved
              </option>

              <option value="rejected">
                Rejected
              </option>
            </select>
          </label>
        </div>

        <table>
          <tbody>
            <tr>
              <td>Current View</td>
              <td>{activeView}</td>
            </tr>

            <tr>
              <td>
                Matching Records
              </td>

              <td className="number-cell">
                {activeView ===
                "allocations"
                  ? filteredAllocations.length
                  : filteredExpenses.length}
              </td>
            </tr>

            <tr>
              <td>
                Matching Value
              </td>

              <td className="amount-cell">
                {activeView ===
                "allocations"
                  ? money(
                      filteredAllocationTotal
                    )
                  : money(
                      filteredExpenseTotal
                    )}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              Pending Expense Approvals
            </h2>

            <p className="muted-text">
              Review submitted expenses
              before they are included
              in worker allocation
              spending.
            </p>
          </div>

          <span className="badge yellow">
            {pendingExpenses.length}{" "}
            pending
          </span>
        </div>

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
              {pendingExpenses.map(
                (expense) => (
                  <tr key={expense.id}>
                    <td>
                      {expense.worker_name ||
                        "-"}
                    </td>

                    <td>
                      {dateOnly(
                        expense.expense_date
                      )}
                    </td>

                    <td className="amount-cell">
                      {money(
                        expense.expense_amount
                      )}
                    </td>

                    <td>
                      {expense.expense_description ||
                        "-"}
                    </td>

                    <td>
                      {expense.uploaded_photo ? (
                        <a
                          href={
                            expense.uploaded_photo
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open Receipt
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          disabled={
                            processingKey !==
                            null
                          }
                          onClick={() =>
                            handleApproveExpense(
                              expense
                            )
                          }
                        >
                          {isProcessing(
                            "approve",
                            expense.id
                          )
                            ? "Processing..."
                            : "Approve"}
                        </button>

                        <button
                          type="button"
                          className="delete-btn"
                          disabled={
                            processingKey !==
                            null
                          }
                          onClick={() =>
                            handleRejectExpense(
                              expense
                            )
                          }
                        >
                          {isProcessing(
                            "reject",
                            expense.id
                          )
                            ? "Processing..."
                            : "Reject"}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}

              {pendingExpenses.length ===
                0 && (
                <tr>
                  <td
                    colSpan="6"
                    className="empty-table-message"
                  >
                    No pending expenses.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {activeView ===
      "allocations" ? (
        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                Allocation Summary
              </h2>

              <p className="muted-text">
                {
                  filteredAllocations.length
                }{" "}
                matching allocation
                {filteredAllocations.length ===
                1
                  ? ""
                  : "s"}{" "}
                ·{" "}
                {money(
                  filteredAllocationRemaining
                )}{" "}
                remaining.
              </p>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Allocated</th>
                  <th>Total Spent</th>
                  <th>Remaining</th>
                  <th>Expenses</th>
                  <th>Status</th>
                  <th>Purpose</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredAllocations.map(
                  (allocation) => (
                    <tr
                      key={
                        allocation.id
                      }
                    >
                      <td>
                        {allocation.worker_name ||
                          "-"}
                      </td>

                      <td className="amount-cell">
                        {money(
                          allocation.allocated_amount
                        )}
                      </td>

                      <td className="amount-cell">
                        {money(
                          allocation.totalSpent
                        )}
                      </td>

                      <td className="amount-cell">
                        <strong>
                          {money(
                            allocation.remainingBalance
                          )}
                        </strong>
                      </td>

                      <td className="number-cell">
                        {
                          allocation.expenseCount
                        }
                      </td>

                      <td>
                        <span
                          className={getStatusClass(
                            allocation.approval_status
                          )}
                        >
                          {normaliseStatus(
                            allocation.approval_status
                          )}
                        </span>
                      </td>

                      <td>
                        {allocation.purpose ||
                          "-"}
                      </td>

                      <td>
                        {dateOnly(
                          allocation.created_at
                        )}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="delete-btn"
                          disabled={
                            processingKey !==
                            null
                          }
                          onClick={() =>
                            requestDeleteAllocation(
                              allocation
                            )
                          }
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                )}

                {filteredAllocations.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan="9"
                      className="empty-table-message"
                    >
                      No matching
                      allocations found.
                    </td>
                  </tr>
                )}
              </tbody>

              {filteredAllocations.length >
                0 && (
                <tfoot>
                  <tr>
                    <td>
                      <strong>
                        Total
                      </strong>
                    </td>

                    <td className="amount-cell">
                      <strong>
                        {money(
                          filteredAllocationTotal
                        )}
                      </strong>
                    </td>

                    <td className="amount-cell">
                      <strong>
                        {money(
                          filteredAllocationSpent
                        )}
                      </strong>
                    </td>

                    <td className="amount-cell">
                      <strong>
                        {money(
                          filteredAllocationRemaining
                        )}
                      </strong>
                    </td>

                    <td colSpan="5" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      ) : (
        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                Worker Expenses
                Register
              </h2>

              <p className="muted-text">
                {
                  filteredExpenses.length
                }{" "}
                matching expense
                {filteredExpenses.length ===
                1
                  ? ""
                  : "s"}{" "}
                ·{" "}
                {money(
                  filteredExpenseTotal
                )}{" "}
                total.
              </p>
            </div>
          </div>

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
                {filteredExpenses.map(
                  (expense) => (
                    <tr
                      key={
                        expense.id
                      }
                    >
                      <td>
                        {expense.worker_name ||
                          "-"}
                      </td>

                      <td>
                        {dateOnly(
                          expense.expense_date
                        )}
                      </td>

                      <td className="amount-cell">
                        {money(
                          expense.expense_amount
                        )}
                      </td>

                      <td className="amount-cell">
                        {money(
                          expense.remaining_balance
                        )}
                      </td>

                      <td>
                        {expense.expense_description ||
                          "-"}
                      </td>

                      <td>
                        <span
                          className={getStatusClass(
                            expense.approval_status
                          )}
                        >
                          {normaliseStatus(
                            expense.approval_status
                          )}
                        </span>
                      </td>

                      <td>
                        {expense.uploaded_photo ? (
                          <a
                            href={
                              expense.uploaded_photo
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open Receipt
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="delete-btn"
                          disabled={
                            processingKey !==
                            null
                          }
                          onClick={() =>
                            requestDeleteExpense(
                              expense
                            )
                          }
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                )}

                {filteredExpenses.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan="8"
                      className="empty-table-message"
                    >
                      No matching
                      expenses found.
                    </td>
                  </tr>
                )}
              </tbody>

              {filteredExpenses.length >
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
                          filteredExpenseTotal
                        )}
                      </strong>
                    </td>

                    <td colSpan="5" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      )}

      <DeleteVerificationModal
        open={Boolean(
          deleteTarget
        )}
        itemName={
          deleteTarget?.type ===
          "allocation"
            ? `${
                deleteTarget.item
                  ?.worker_name ||
                "worker"
              } allocation`
            : `${
                deleteTarget?.item
                  ?.worker_name ||
                "worker"
              } expense`
        }
        onCancel={() => {
          if (
            processingKey === null
          ) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={
          handleConfirmDelete
        }
        loading={
          processingKey?.startsWith(
            "delete:"
          ) || false
        }
      />
    </>
  );
}

export default WorkerMoneyPage;