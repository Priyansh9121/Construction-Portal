function WorkerMoneyPage({
    workers,
    allocations,
    expenses,
    addAllocation,
    addExpense,
  }) {
    const allocationSummary = allocations.map((allocation) => {
      const relatedExpenses = expenses.filter(
        (expense) => expense.allocation_id === allocation.id
      );
  
      const totalSpent = relatedExpenses.reduce(
        (sum, expense) => sum + Number(expense.expense_amount),
        0
      );
  
      const remainingBalance =
        Number(allocation.allocated_amount) - totalSpent;
  
      return {
        ...allocation,
        totalSpent,
        remainingBalance,
      };
    });
  
    return (
      <>
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
  
              <textarea
                name="purpose"
                placeholder="Purpose"
              ></textarea>
  
              <button type="submit">
                Allocate Money
              </button>
            </form>
          </div>
  
          <div className="panel">
            <h2>Add Worker Expense</h2>
  
            <form className="payment-form" onSubmit={addExpense}>
              <select name="allocation_id" required>
                <option value="">Select Allocation</option>
  
                {allocations.map((allocation) => (
                  <option
                    key={allocation.id}
                    value={allocation.id}
                  >
                    {allocation.worker_name} - $
                    {Number(
                      allocation.allocated_amount
                    ).toFixed(2)}
                  </option>
                ))}
              </select>
  
              <input
                name="expense_amount"
                type="number"
                placeholder="Expense Amount"
                required
              />
  
              <input
                name="expense_date"
                type="date"
                required
              />
  
              <textarea
                name="expense_description"
                placeholder="Expense Description"
              ></textarea>
  
              <button type="submit">
                Add Expense
              </button>
            </form>
          </div>
        </section>
  
        <section className="panel">
          <h2>Allocation Summary</h2>
  
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th>Allocated</th>
                <th>Total Spent</th>
                <th>Remaining</th>
                <th>Purpose</th>
                <th>Date</th>
              </tr>
            </thead>
  
            <tbody>
              {allocationSummary.map((allocation) => (
                <tr key={allocation.id}>
                  <td>{allocation.worker_name}</td>
  
                  <td>
                    $
                    {Number(
                      allocation.allocated_amount
                    ).toFixed(2)}
                  </td>
  
                  <td>
                    $
                    {allocation.totalSpent.toFixed(2)}
                  </td>
  
                  <td>
                    $
                    {allocation.remainingBalance.toFixed(2)}
                  </td>
  
                  <td>{allocation.purpose}</td>
  
                  <td>
                    {allocation.created_at?.slice(0, 10)}
                  </td>
                </tr>
              ))}
  
              {allocationSummary.length === 0 && (
                <tr>
                  <td colSpan="6">
                    No allocations added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
  
        <section className="panel">
          <h2>Worker Expense History</h2>
  
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th>Expense</th>
                <th>Description</th>
                <th>Date</th>
                <th>Remaining Balance</th>
              </tr>
            </thead>
  
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{expense.worker_name}</td>
  
                  <td>
                    $
                    {Number(
                      expense.expense_amount
                    ).toFixed(2)}
                  </td>
  
                  <td>
                    {expense.expense_description}
                  </td>
  
                  <td>
                    {expense.expense_date?.slice(0, 10)}
                  </td>
  
                  <td>
                    $
                    {Number(
                      expense.remaining_balance
                    ).toFixed(2)}
                  </td>
                </tr>
              ))}
  
              {expenses.length === 0 && (
                <tr>
                  <td colSpan="5">
                    No worker expenses added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </>
    );
  }
  
  export default WorkerMoneyPage;