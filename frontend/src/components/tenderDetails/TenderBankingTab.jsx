function TenderBankingTab({
    banking,
    bankingForm,
    setBankingForm,
    handleAddBanking,
    setDeleteTarget,
    bankingTotal,
    gstTotal,
    loanedTotal,
    returnedTotal,
  }) {
    return (
      <>
        <div className="summary-cards">
          <div className="card">
            <p>Total Banking</p>
            <h2>${bankingTotal.toFixed(2)}</h2>
          </div>
  
          <div className="card">
            <p>GST Total</p>
            <h2>${gstTotal.toFixed(2)}</h2>
          </div>
  
          <div className="card">
            <p>Loaned Amount</p>
            <h2>${loanedTotal.toFixed(2)}</h2>
          </div>
  
          <div className="card">
            <p>Returned by Company</p>
            <h2>${returnedTotal.toFixed(2)}</h2>
          </div>
        </div>
  
        <div className="payment-grid">
          <div className="panel">
            <h2>Add Banking Entry</h2>
  
            <form className="payment-form" onSubmit={handleAddBanking}>
              <select
                value={bankingForm.payment_type}
                onChange={(e) =>
                  setBankingForm({
                    ...bankingForm,
                    payment_type: e.target.value,
                  })
                }
                required
              >
                <option value="">Select Payment Type</option>
                <option value="government_payment">Government Payment</option>
                <option value="company_returned">Returned by Company</option>
                <option value="loaned_amount">Loaned Amount</option>
                <option value="third_party_payment">Third Party Payment</option>
                <option value="gst_payment">GST Payment</option>
                <option value="subcontractor_payment">
                  Subcontractor Payment
                </option>
                <option value="material_payment">Material Payment</option>
                <option value="other">Other</option>
              </select>
  
              <input
                placeholder="Bank name"
                value={bankingForm.bank_name}
                onChange={(e) =>
                  setBankingForm({
                    ...bankingForm,
                    bank_name: e.target.value,
                  })
                }
              />
  
              <input
                placeholder="Account name"
                value={bankingForm.account_name}
                onChange={(e) =>
                  setBankingForm({
                    ...bankingForm,
                    account_name: e.target.value,
                  })
                }
              />
  
              <input
                placeholder="Account number"
                value={bankingForm.account_number}
                onChange={(e) =>
                  setBankingForm({
                    ...bankingForm,
                    account_number: e.target.value,
                  })
                }
              />
  
              <input
                placeholder="Amount"
                type="number"
                value={bankingForm.amount}
                onChange={(e) =>
                  setBankingForm({
                    ...bankingForm,
                    amount: e.target.value,
                  })
                }
              />
  
              <input
                placeholder="GST Amount"
                type="number"
                value={bankingForm.gst_amount}
                onChange={(e) =>
                  setBankingForm({
                    ...bankingForm,
                    gst_amount: e.target.value,
                  })
                }
              />
  
              <input
                type="date"
                value={bankingForm.payment_date}
                onChange={(e) =>
                  setBankingForm({
                    ...bankingForm,
                    payment_date: e.target.value,
                  })
                }
              />
  
              <input
                placeholder="Notes"
                value={bankingForm.notes}
                onChange={(e) =>
                  setBankingForm({
                    ...bankingForm,
                    notes: e.target.value,
                  })
                }
              />
  
              <button type="submit">Add Banking Entry</button>
            </form>
          </div>
  
          <div className="panel">
            <h2>Banking / Payments</h2>
  
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Bank</th>
                    <th>Account</th>
                    <th>Amount</th>
                    <th>GST</th>
                    <th>Date</th>
                    <th>Notes</th>
                    <th>Action</th>
                  </tr>
                </thead>
  
                <tbody>
                  {banking.map((item) => (
                    <tr key={item.id}>
                      <td>{item.payment_type}</td>
                      <td>{item.bank_name}</td>
                      <td>{item.account_name}</td>
                      <td>{item.amount}</td>
                      <td>{item.gst_amount}</td>
                      <td>{item.payment_date}</td>
                      <td>{item.notes}</td>
                      <td>
                        <button
                          type="button"
                          className="delete-btn"
                          onClick={() =>
                            setDeleteTarget({
                              type: "banking",
                              item,
                            })
                          }
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
  
                  {banking.length === 0 && (
                    <tr>
                      <td colSpan="8" className="empty-table-message">
                        No banking entries added yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </>
    );
  }
  
  export default TenderBankingTab;