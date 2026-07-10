import { formatCurrency } from "../../utils/currency";
function SiteTenderTable({
    tenders = [],
    onOpenTender,
  }) {
    return (
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Tender</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Value</th>
              <th>Action</th>
            </tr>
          </thead>
  
          <tbody>
            {tenders.map((tender) => (
              <tr key={tender.id}>
                <td>{tender.title}</td>
  
                <td>{tender.status}</td>
  
                <td>
                  {tender.due_date?.slice(0, 10)}
                </td>
  
                <td className="amount-cell">
                  {formatCurrency(tender.estimated_value)}
                </td>
  
                <td>
                  <button
                    onClick={() =>
                      onOpenTender(tender.id)
                    }
                  >
                    Open Tender
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  
  export default SiteTenderTable;