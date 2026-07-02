import {
    money,
    getSiteName,
    getTenderName,
  } from "../../utils/paymentHelpers";
  
  function PaymentRecordsTable({
    activeSection,
    payments,
    searchTerm,
    setSearchTerm,
    sites,
    tenders,
    startEdit,
    setDeleteTarget,
  }) {
    const renderActionButtons = (payment) => {
      return (
        <td>
          <button type="button" onClick={() => startEdit(payment)}>
            Edit
          </button>
  
          <button
            type="button"
            className="delete-btn"
            onClick={() => setDeleteTarget(payment)}
          >
            Delete
          </button>
        </td>
      );
    };
  
    const renderTableHeaders = () => {
      if (activeSection.subType === "INVESTOR") {
        return (
          <tr>
            <th>Name</th>
            <th>FD / Site</th>
            <th>Date</th>
            <th>Amount</th>
            <th>Mode</th>
            <th>Interest %</th>
            <th>Details</th>
            <th>Action</th>
          </tr>
        );
      }
  
      if (activeSection.subType === "GOVERNMENT_BILL") {
        return (
          <tr>
            <th>Date</th>
            <th>Amount</th>
            <th>GST Amount</th>
            <th>Collected GST</th>
            <th>Action</th>
          </tr>
        );
      }
  
      if (activeSection.subType === "MATERIAL") {
        return (
          <tr>
            <th>Material</th>
            <th>Quantity</th>
            <th>Date</th>
            <th>Amount</th>
            <th>GST</th>
            <th>Site</th>
            <th>Tender</th>
            <th>Details</th>
            <th>Action</th>
          </tr>
        );
      }
  
      if (activeSection.subType === "COMPANY_CHARGE") {
        return (
          <tr>
            <th>Tender</th>
            <th>Date</th>
            <th>Bill Amount</th>
            <th>Charge %</th>
            <th>Charge Amount</th>
            <th>GST Received</th>
            <th>Details</th>
            <th>Action</th>
          </tr>
        );
      }
  
      return (
        <tr>
          <th>Name / Type</th>
          <th>Date</th>
          <th>Amount</th>
          <th>Details</th>
          <th>Action</th>
        </tr>
      );
    };
  
    const renderTableRow = (payment) => {
      if (activeSection.subType === "INVESTOR") {
        return (
          <tr key={payment.id}>
            <td>{payment.investor_name || "-"}</td>
            <td>{payment.fd_site || "-"}</td>
            <td>{payment.payment_date?.slice(0, 10)}</td>
            <td>{money(payment.amount)}</td>
            <td>{payment.payment_mode || "-"}</td>
            <td>{payment.interest_percent || 0}%</td>
            <td>{payment.details || payment.description || "-"}</td>
            {renderActionButtons(payment)}
          </tr>
        );
      }
  
      if (activeSection.subType === "GOVERNMENT_BILL") {
        return (
          <tr key={payment.id}>
            <td>{payment.payment_date?.slice(0, 10)}</td>
            <td>{money(payment.amount)}</td>
            <td>{money(payment.gst_amount)}</td>
            <td>{money(payment.collected_gst)}</td>
            {renderActionButtons(payment)}
          </tr>
        );
      }
  
      if (activeSection.subType === "MATERIAL") {
        return (
          <tr key={payment.id}>
            <td>{payment.material_name || "-"}</td>
            <td>{payment.quantity || 0}</td>
            <td>{payment.payment_date?.slice(0, 10)}</td>
            <td>{money(payment.amount)}</td>
            <td>{money(payment.gst_amount)}</td>
            <td>{getSiteName(sites, payment.site_id)}</td>
            <td>{getTenderName(tenders, payment.tender_id)}</td>
            <td>{payment.details || payment.description || "-"}</td>
            {renderActionButtons(payment)}
          </tr>
        );
      }
  
      if (activeSection.subType === "COMPANY_CHARGE") {
        return (
          <tr key={payment.id}>
            <td>{getTenderName(tenders, payment.tender_id)}</td>
            <td>{payment.payment_date?.slice(0, 10)}</td>
            <td>{money(payment.amount)}</td>
            <td>{payment.interest_percent || 0}%</td>
            <td>{money(payment.gst_amount)}</td>
            <td>{money(payment.collected_gst)}</td>
            <td>{payment.details || payment.description || "-"}</td>
            {renderActionButtons(payment)}
          </tr>
        );
      }
  
      return (
        <tr key={payment.id}>
          <td>{payment.worker_name || payment.category || activeSection.label}</td>
          <td>{payment.payment_date?.slice(0, 10)}</td>
          <td>{money(payment.amount)}</td>
          <td>{payment.details || payment.description || "-"}</td>
          {renderActionButtons(payment)}
        </tr>
      );
    };
  
    return (
      <div className="panel">
        <h2>{activeSection.label} Records</h2>
  
        <input
          className="search-input"
          type="text"
          placeholder="Search records..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
  
        <div className="table-wrapper">
          <table>
            <thead>{renderTableHeaders()}</thead>
  
            <tbody>
              {payments.map(renderTableRow)}
  
              {payments.length === 0 && (
                <tr>
                  <td colSpan="9" className="empty-table-message">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  
  export default PaymentRecordsTable;