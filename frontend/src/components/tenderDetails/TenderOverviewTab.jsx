function TenderOverviewTab({
    tenderValue,
    remainingBudget,
    documents,
    materialTotal,
    bankingTotal,
    dailyUpdates,
    tenderIncome,
    totalTenderCost,
    tenderProfit,
    tenderProfitPercentage,
    financeSummary,
    materialCost,
    subcontractorCost,
    bankingCost,
  }) {
    return (
      <>
        <div className="summary-cards">
          <div className="card">
            <p>Tender Value</p>
            <h2>${tenderValue.toFixed(2)}</h2>
          </div>
  
          <div className="card">
            <p>Remaining Budget</p>
            <h2>${remainingBudget.toFixed(2)}</h2>
          </div>
  
          <div className="card">
            <p>Documents</p>
            <h2>{documents.length}</h2>
          </div>
  
          <div className="card">
            <p>Material Total</p>
            <h2>${materialTotal.toFixed(2)}</h2>
          </div>
  
          <div className="card">
            <p>Banking Total</p>
            <h2>${bankingTotal.toFixed(2)}</h2>
          </div>
  
          <div className="card">
            <p>Daily Updates</p>
            <h2>{dailyUpdates.length}</h2>
          </div>
  
          <div className="card">
            <p>Tender Income</p>
            <h2>${tenderIncome.toFixed(2)}</h2>
          </div>
  
          <div className="card">
            <p>Total Cost</p>
            <h2>${totalTenderCost.toFixed(2)}</h2>
          </div>
  
          <div className="card">
            <p>Profit / Loss</p>
            <h2>${tenderProfit.toFixed(2)}</h2>
          </div>
  
          <div className="card">
            <p>Profit %</p>
            <h2>{tenderProfitPercentage.toFixed(2)}%</h2>
          </div>
  
          <div
            className="card"
            style={{
              background: "#fff3cd",
              border: "2px solid #ffc107",
            }}
          >
            <p style={{ fontWeight: "bold", color: "#856404" }}>
              Baki GST
            </p>
  
            <h2 style={{ color: "#dc3545" }}>
              ${Number(financeSummary?.gst_left || 0).toFixed(2)}
            </h2>
          </div>
  
          <div
            className="card"
            style={{
              background: "#ffe5e5",
              border: "2px solid #dc3545",
            }}
          >
            <p style={{ fontWeight: "bold", color: "#dc3545" }}>
              Baki Company Charge
            </p>
  
            <h2 style={{ color: "#dc3545" }}>
              ${Number(financeSummary?.company_charge_left || 0).toFixed(2)}
            </h2>
          </div>
  
          <div
            className="card"
            style={{
              background: "#e8f5e9",
              border: "2px solid #28a745",
            }}
          >
            <p style={{ fontWeight: "bold" }}>Overall Done</p>
  
            <h2 style={{ color: "#28a745" }}>
              ${Number(financeSummary?.overall_done || 0).toFixed(2)}
            </h2>
          </div>
  
          <div
            className="card"
            style={{
              background: "#fff3cd",
              border: "2px solid #fd7e14",
            }}
          >
            <p style={{ fontWeight: "bold", color: "#fd7e14" }}>
              Overall Left
            </p>
  
            <h2 style={{ color: "#fd7e14" }}>
              ${Number(financeSummary?.overall_left || 0).toFixed(2)}
            </h2>
          </div>
        </div>
  
        <div className="panel">
          <h2>Tender Profit Breakdown</h2>
  
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Amount</th>
              </tr>
            </thead>
  
            <tbody>
              <tr>
                <td>Tender Value</td>
                <td>${tenderValue.toFixed(2)}</td>
              </tr>
  
              <tr>
                <td>Remaining Budget</td>
                <td>${remainingBudget.toFixed(2)}</td>
              </tr>
  
              <tr>
                <td>Tender Income</td>
                <td>${tenderIncome.toFixed(2)}</td>
              </tr>
  
              <tr>
                <td>Material Cost</td>
                <td>${materialCost.toFixed(2)}</td>
              </tr>
  
              <tr>
                <td>Subcontractor Cost</td>
                <td>${subcontractorCost.toFixed(2)}</td>
              </tr>
  
              <tr>
                <td>Banking/Other Cost</td>
                <td>${bankingCost.toFixed(2)}</td>
              </tr>
  
              <tr>
                <td>Total Cost</td>
                <td>${totalTenderCost.toFixed(2)}</td>
              </tr>
  
              <tr>
                <td>Profit / Loss</td>
                <td>${tenderProfit.toFixed(2)}</td>
              </tr>
  
              <tr>
                <td>Profit Percentage</td>
                <td>{tenderProfitPercentage.toFixed(2)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </>
    );
  }
  
  export default TenderOverviewTab;