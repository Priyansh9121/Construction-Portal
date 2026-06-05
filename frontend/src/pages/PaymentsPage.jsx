function PaymentsPage({ payments, addPayment, deletePayment }) {
    const totalIncome = payments
      .filter((p) => p.payment_type === "Income")
      .reduce((sum, p) => sum + Number(p.amount), 0);
  
    const totalExpense = payments
      .filter((p) => p.payment_type === "Expense")
      .reduce((sum, p) => sum + Number(p.amount), 0);
  
    const balance = totalIncome - totalExpense;
  
    return (
      <>
        <section className="summary-cards">
          <div className="card">
            <p>Total Income</p>
            <h2>${totalIncome.toFixed(2)}</h2>
          </div>
  
          <div className="card">
            <p>Total Expense</p>
            <h2>${totalExpense.toFixed(2)}</h2>
          </div>
  
          <div className="card">
            <p>Balance</p>
            <h2>${balance.toFixed(2)}</h2>
          </div>
        </section>
  
        <section className="payment-grid">
          <div className="panel">
            <h2>Add Payment</h2>
  
            <form className="payment-form" onSubmit={addPayment}>
              <select name="payment_type" required>
                <option value="">Select Payment Type</option>
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
                <option value="Investment">Partner Investment</option>
                <option value="Loan">Loan</option>
                <option value="Return">Returned Payment</option>
              </select>
  
              <select name="category" required>
                <option value="">Select Category</option>
                <option value="Government Payment">Government Payment</option>
                <option value="Worker Salary">Worker Salary</option>
                <option value="Subcontractor Payment">
                  Subcontractor Payment
                </option>
                <option value="Partner Internal Transfer">
                  Partner Internal Transfer
                </option>
                <option value="Personal Investment">Personal Investment</option>
                <option value="Company Expense">Company Expense</option>
                <option value="Material Purchase">Material Purchase</option>
              </select>
  
              <input name="amount" type="number" placeholder="Amount" required />
  
              <input name="payment_date" type="date" required />
  
              <textarea name="description" placeholder="Description"></textarea>
  
              <button type="submit">Add Payment</button>
            </form>
          </div>
  
          <div className="panel">
            <h2>Payment Records</h2>
  
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Action</th>
                </tr>
              </thead>
  
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.payment_type}</td>
                    <td>{payment.category}</td>
                    <td>
                      {payment.payment_date
                        ? payment.payment_date.slice(0, 10)
                        : ""}
                    </td>
                    <td>{payment.description}</td>
                    <td>${Number(payment.amount).toFixed(2)}</td>
                    <td>
                      <button
                        className="delete-btn"
                        onClick={() => deletePayment(payment.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
  
                {payments.length === 0 && (
                  <tr>
                    <td colSpan="6">No payments added yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }
  
  export default PaymentsPage;