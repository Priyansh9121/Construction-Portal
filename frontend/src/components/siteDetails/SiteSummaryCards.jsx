import { formatCurrency } from "../../utils/currency";
function SiteSummaryCards({
    totalTenders,
    runningTenders,
    passedTenders,
    dueSoonTenders,
    totalValue,
  }) {
    return (
      <div className="summary-cards">
        <div className="card">
          <p>Total Tenders</p>
          <h2>{totalTenders}</h2>
        </div>
  
        <div className="card">
          <p>Running</p>
          <h2>{runningTenders}</h2>
        </div>
  
        <div className="card">
          <p>Passed</p>
          <h2>{passedTenders}</h2>
        </div>
  
        <div className="card">
          <p>Due Soon</p>
          <h2>{dueSoonTenders}</h2>
        </div>
  
        <div className="card">
          <p>Total Value</p>
          <h2>{formatCurrency(totalValue)}</h2>
        </div>
      </div>
    );
  }
  
  export default SiteSummaryCards;