import { formatCurrency } from "../../utils/currency";
function TenderBankingTab({
  banking = [],
  bankingForm,
  setBankingForm,
  handleAddBanking,
  setDeleteTarget,
  bankingTotal = 0,
  gstTotal = 0,
  loanedTotal = 0,
  returnedTotal = 0,
}) {
  const money = formatCurrency;

  const dateOnly = (value) => (value ? String(value).slice(0, 10) : "");

  const netLoanBalance = Number(loanedTotal || 0) - Number(returnedTotal || 0);

  const paymentTypeSummary = banking.reduce((acc, item) => {
    const type = item.payment_type || "other";
    acc[type] = (acc[type] || 0) + Number(item.amount || 0);
    return acc;
  }, {});

  const typeRows = Object.entries(paymentTypeSummary)
    .map(([type, amount]) => ({
      type,
      amount,
      percent:
        Number(bankingTotal || 0) > 0
          ? (Number(amount || 0) / Number(bankingTotal || 0)) * 100
          : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const previewAmount = Number(bankingForm.amount || 0);
  const previewGst = Number(bankingForm.gst_amount || 0);

  return (
    <>
      <section className="summary-cards">
        <div className="card">
          <p>Total Banking</p>
          <h2>{money(bankingTotal)}</h2>
        </div>

        <div className="card highlight-warning">
          <p>GST Total</p>
          <h2>{money(gstTotal)}</h2>
        </div>

        <div className="card">
          <p>Loaned Amount</p>
          <h2>{money(loanedTotal)}</h2>
        </div>

        <div className="card">
          <p>Returned by Company</p>
          <h2>{money(returnedTotal)}</h2>
        </div>

        <div
          className={
            netLoanBalance > 0 ? "card highlight-danger" : "card highlight-success"
          }
        >
          <p>Net Loan Balance</p>
          <h2>{money(netLoanBalance)}</h2>
        </div>

        <div className="card">
          <p>Banking Entries</p>
          <h2>{banking.length}</h2>
        </div>
      </section>

      <div className="payment-grid">
        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Add Banking Entry</h2>
              <p className="muted-text">
                Track government payments, company returns, GST, loan and
                subcontractor/material payments.
              </p>
            </div>
          </div>

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
              <option value="subcontractor_payment">Subcontractor Payment</option>
              <option value="material_payment">Material Payment</option>
              <option value="other">Other</option>
            </select>

            <div className="form-grid">
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
                type="date"
                value={bankingForm.payment_date}
                onChange={(e) =>
                  setBankingForm({
                    ...bankingForm,
                    payment_date: e.target.value,
                  })
                }
              />
            </div>

            <div className="form-grid">
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
            </div>

            <p className="form-preview-total">
              Preview: Amount {money(previewAmount)} | GST {money(previewGst)}
            </p>

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
          <div className="section-title-row">
            <div>
              <h2>Banking Type Summary</h2>
              <p className="muted-text">
                Breakdown by payment category for this tender.
              </p>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Payment Type</th>
                  <th>Total Amount</th>
                  <th>% of Banking</th>
                </tr>
              </thead>

              <tbody>
                {typeRows.map((row) => (
                  <tr key={row.type}>
                    <td>{row.type.replaceAll("_", " ")}</td>
                    <td className="amount-cell">{money(row.amount)}</td>
                    <td className="amount-cell">{row.percent.toFixed(2)}%</td>
                  </tr>
                ))}

                {typeRows.length === 0 && (
                  <tr>
                    <td colSpan="3" className="empty-table-message">
                      No banking summary available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Banking / Payments Register</h2>
            <p className="muted-text">
              Complete transaction list for banking and payment tracking.
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Bank</th>
                <th>Account</th>
                <th>Account No.</th>
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
                  <td>{item.payment_type?.replaceAll("_", " ") || "-"}</td>
                  <td>{item.bank_name || "-"}</td>
                  <td>{item.account_name || "-"}</td>
                  <td>{item.account_number || "-"}</td>
                  <td className="amount-cell">{money(item.amount)}</td>
                  <td className="amount-cell">{money(item.gst_amount)}</td>
                  <td>{dateOnly(item.payment_date)}</td>
                  <td>{item.notes || "-"}</td>
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
                  <td colSpan="9" className="empty-table-message">
                    No banking entries added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default TenderBankingTab;