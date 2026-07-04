import FinanceSummaryCards from "../finance/FinanceSummaryCards";
import FinanceRecordsTable from "../finance/FinanceRecordsTable";
import { usePaymentManager } from "../../hooks/usePaymentManager";

function TenderFinanceTab({
  payments = [],
  tenderId,
  startEditPayment,
  setDeleteTarget,
}) {
  const { filteredPayments, summary } = usePaymentManager({
    payments,
    tenderId,
  });

  return (
    <>
      <FinanceSummaryCards summary={summary} />

      <FinanceRecordsTable
        title="Tender Finance Records"
        payments={filteredPayments}
        onEdit={startEditPayment}
        onDelete={(payment) =>
          setDeleteTarget({
            type: "payment",
            item: payment,
          })
        }
      />
    </>
  );
}

export default TenderFinanceTab;