import {
  FINANCE_RECORD_TYPES,
  FINANCE_TYPE_LABELS,
  PAYMENT_MODES,
} from "../../config/financeConstants";

function TenderFinanceTab({
    financeSummary,
    financeRecords,
    financeForm,
    setFinanceForm,
    editingFinance,
    setEditingFinance,
    handleAddFinanceRecord,
    startEditFinanceRecord,
    setDeleteTarget,
    calculatedGstTotal,
    calculatedCompanyChargeTotal,
  }) {
    const financeTypeOptions = Object.values(FINANCE_RECORD_TYPES).map((value) => ({
      value,
      label: FINANCE_TYPE_LABELS[value],
    }));
    
    const paymentModeOptions = Object.values(PAYMENT_MODES).map((value) => ({
      value,
      label: value.toUpperCase(),
    }));

    const resetFinanceForm = () => {
      setEditingFinance(null);
  
      setFinanceForm({
        record_type: "GOVERNMENT_BILL",
        source_name: "",
        payment_mode: PAYMENT_MODES.BANK,
        amount: "",
        interest_percent: "",
        gst_percent: "18",
        gst_total: "",
        gst_done: "",
        company_charge_percent: "",
        company_charge_total: "",
        company_charge_done: "",
        tds_amount: "",
        record_date: "",
        notes: "",
      });
    };
  
    return (
      <>
        <div className="summary-cards">
        <div className="card">
          <p>Investor Total</p>
          <h2>${Number(financeSummary?.investor_total || 0).toFixed(2)}</h2>
        </div>

        <div className="card">
          <p>Government Bills</p>
          <h2>${Number(financeSummary?.government_bill_total || 0).toFixed(2)}</h2>
        </div>

        <div className="card">
          <p>Subcontractor Total</p>
          <h2>${Number(financeSummary?.subcontractor_total || 0).toFixed(2)}</h2>
        </div>

        <div className="card">
          <p>Office Total</p>
          <h2>${Number(financeSummary?.office_total || 0).toFixed(2)}</h2>
        </div>

        <div className="card">
          <p>TDS Total</p>
          <h2>${Number(financeSummary?.tds_total || 0).toFixed(2)}</h2>
        </div>

        <div className="stat-card">
          <p>Total Income</p>
          <h2>${Number(financeSummary?.total_income || 0).toFixed(2)}</h2>
        </div>

        <div className="stat-card">
          <p>Total Expense</p>
          <h2>${Number(financeSummary?.total_expense || 0).toFixed(2)}</h2>
        </div>

        <div className="stat-card">
          <p>Net Profit</p>
          <h2>${Number(financeSummary?.net_profit || 0).toFixed(2)}</h2>
        </div>
          <div className="card">
            <p>GST Total</p>
            <h2>${Number(financeSummary?.gst_total || 0).toFixed(2)}</h2>
          </div>
  
          <div className="card">
            <p>GST Done</p>
            <h2>${Number(financeSummary?.gst_done || 0).toFixed(2)}</h2>
          </div>
  
          <div
            className="stat-card"
            style={{
              background: "#fff3cd",
              border: "2px solid #ffc107",
            }}
          >
            <p style={{ color: "#856404", fontWeight: "bold" }}>Baki GST</p>
            <h2 style={{ color: "#dc3545", fontWeight: "bold" }}>
              ${Number(financeSummary?.gst_left || 0).toFixed(2)}
            </h2>
          </div>
  
          <div className="card">
            <p>Company Charge</p>
            <h2>
              ${Number(financeSummary?.company_charge_total || 0).toFixed(2)}
            </h2>
          </div>
  
          <div className="card">
            <p>Company Charge Done</p>
            <h2>
              ${Number(financeSummary?.company_charge_done || 0).toFixed(2)}
            </h2>
          </div>
  
          <div
            className="stat-card"
            style={{
              background: "#ffe5e5",
              border: "2px solid #dc3545",
            }}
          >
            <p style={{ color: "#dc3545", fontWeight: "bold" }}>
              Baki Company Charge
            </p>
            <h2 style={{ color: "#dc3545", fontWeight: "bold" }}>
              ${Number(financeSummary?.company_charge_left || 0).toFixed(2)}
            </h2>
          </div>
  
          <div className="stat-card">
            <p>Overall Total</p>
            <h2>${Number(financeSummary?.overall_total || 0).toFixed(2)}</h2>
          </div>
  
          <div className="stat-card">
            <p>Overall Done</p>
            <h2>${Number(financeSummary?.overall_done || 0).toFixed(2)}</h2>
          </div>
  
          <div
            className="stat-card"
            style={{
              background: "#fff3cd",
              border: "2px solid #fd7e14",
            }}
          >
            <p style={{ color: "#fd7e14", fontWeight: "bold" }}>
              Overall Left
            </p>
            <h2 style={{ color: "#fd7e14", fontWeight: "bold" }}>
              ${Number(financeSummary?.overall_left || 0).toFixed(2)}
            </h2>
          </div>
        </div>
  
        <div className="payment-grid">
          <div className="panel">
            <h2>{editingFinance ? "Edit Finance Record" : "Add Finance Record"}</h2>
  
            <form className="payment-form" onSubmit={handleAddFinanceRecord}>
              <select
                value={financeForm.record_type}
                onChange={(e) => {
                  const type = e.target.value;
  
                  setFinanceForm({
                    ...financeForm,
                    record_type: type,
                    gst_percent: type === "GOVERNMENT_BILL" ? "18" : "",
                    company_charge_percent:
                      type === "COMPANY_CHARGE" ? "2" : "",
                    gst_total: "",
                    company_charge_total: "",
                  });
                }}
              >
                {financeTypeOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
  
              <input
                placeholder={
                  financeForm.record_type === "INVESTOR"
                    ? "Investor Name"
                    : financeForm.record_type === "OFFICE"
                    ? "Source / Company Name"
                    : "Source Name"
                }
                value={financeForm.source_name}
                onChange={(e) =>
                  setFinanceForm({
                    ...financeForm,
                    source_name: e.target.value,
                  })
                }
              />
  
              <select
                value={financeForm.payment_mode}
                onChange={(e) =>
                  setFinanceForm({
                    ...financeForm,
                    payment_mode: e.target.value,
                  })
                }
              >
               {paymentModeOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
              </select>
  
              <input
                placeholder="Amount"
                type="number"
                value={financeForm.amount}
                onChange={(e) =>
                  setFinanceForm({
                    ...financeForm,
                    amount: e.target.value,
                  })
                }
              />

              {financeForm.record_type === "TDS" && (
                <input
                  placeholder="TDS Amount"
                  type="number"
                  value={financeForm.tds_amount}
                  onChange={(e) =>
                    setFinanceForm({
                      ...financeForm,
                      tds_amount: e.target.value,
                    })
                  }
                />
              )}
  
              {financeForm.record_type === "INVESTOR" && (
                <input
                  placeholder="Interest %"
                  type="number"
                  value={financeForm.interest_percent}
                  onChange={(e) =>
                    setFinanceForm({
                      ...financeForm,
                      interest_percent: e.target.value,
                    })
                  }
                />
              )}
  
              {financeForm.record_type === "GOVERNMENT_BILL" && (
                <>
                  <input
                    placeholder="GST %"
                    type="number"
                    value={financeForm.gst_percent}
                    onChange={(e) =>
                      setFinanceForm({
                        ...financeForm,
                        gst_percent: e.target.value,
                      })
                    }
                  />
  
                  <p className="form-preview-total">
                    GST Total: ${calculatedGstTotal.toFixed(2)}
                  </p>
                </>
              )}

              {financeForm.record_type === "GST_RETURN" && (
                <p className="form-preview-total">
                  This amount will be counted as GST Done / GST Return.
                </p>
              )}
  
              {financeForm.record_type === "COMPANY_CHARGE" && (
                <>
                  <input
                    placeholder="Company Charge %"
                    type="number"
                    value={financeForm.company_charge_percent}
                    onChange={(e) =>
                      setFinanceForm({
                        ...financeForm,
                        company_charge_percent: e.target.value,
                      })
                    }
                  />
  
                  <p className="form-preview-total">
                    Company Charge: ${calculatedCompanyChargeTotal.toFixed(2)}
                  </p>
                </>
              )}

              {financeForm.record_type === "COMPANY_CHARGE_PAYMENT" && (
                <p className="form-preview-total">
                  This amount will be counted as Company Charge Done.
                </p>
              )}
  
              <input
                type="date"
                value={financeForm.record_date}
                onChange={(e) =>
                  setFinanceForm({
                    ...financeForm,
                    record_date: e.target.value,
                  })
                }
              />
  
              <input
                placeholder="Notes"
                value={financeForm.notes}
                onChange={(e) =>
                  setFinanceForm({
                    ...financeForm,
                    notes: e.target.value,
                  })
                }
              />
  
              <button type="submit">
                {editingFinance ? "Save Finance Record" : "Add Finance Record"}
              </button>
  
              {editingFinance && (
                <button type="button" onClick={resetFinanceForm}>
                  Cancel Edit
                </button>
              )}
            </form>
          </div>
  
          <div className="panel">
            <h2>Finance Records</h2>
  
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Source</th>
                    <th>Amount</th>
                    <th>GST Total</th>
                    <th>GST Done</th>
                    <th>Company Charge Total</th>
                    <th>Company Charge Done</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
  
                <tbody>
                  {financeRecords.map((item) => (
                    <tr key={item.id}>
                      <td>{FINANCE_TYPE_LABELS[item.record_type] || item.record_type}</td>
                      <td>{item.source_name}</td>
                      <td>${Number(item.amount || 0).toFixed(2)}</td>
                      <td>${Number(item.gst_total || 0).toFixed(2)}</td>
                      <td>${Number(item.gst_done || 0).toFixed(2)}</td>
                      <td>
                        ${Number(item.company_charge_total || 0).toFixed(2)}
                      </td>
                      <td>
                        ${Number(item.company_charge_done || 0).toFixed(2)}
                      </td>
                      <td>{item.record_date?.slice(0, 10)}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => startEditFinanceRecord(item)}
                        >
                          Edit
                        </button>
  
                        <button
                          type="button"
                          className="delete-btn"
                          onClick={() =>
                            setDeleteTarget({
                              type: "finance",
                              item,
                            })
                          }
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
  
                  {financeRecords.length === 0 && (
                    <tr>
                      <td colSpan="9" className="empty-table-message">
                        No finance records yet.
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
  
  export default TenderFinanceTab;