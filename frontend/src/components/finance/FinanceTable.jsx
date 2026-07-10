import { useMemo, useState } from "react";
import { getFinanceName, getTenderTitle, money } from "../../utils/financeHelper";
import FinanceFilters from "./FinanceFilters";
import ExportButtons from "../export/ExportButtons";

function FinanceTable({
  payments = [],
  tenders = [],
  onEdit,
  onDelete,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterScope, setFilterScope] = useState("all");
  const [filterTender, setFilterTender] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  const pageSize = 10;

  const filteredPayments = useMemo(() => {
    const search = searchTerm.toLowerCase();

    return payments.filter((payment) => {
      const tenderTitle = getTenderTitle(tenders, payment.tender_id).toLowerCase();

      const matchesSearch =
        payment.payment_type?.toLowerCase().includes(search) ||
        payment.payment_scope?.toLowerCase().includes(search) ||
        payment.payment_sub_type?.toLowerCase().includes(search) ||
        payment.category?.toLowerCase().includes(search) ||
        payment.investor_name?.toLowerCase().includes(search) ||
        payment.worker_name?.toLowerCase().includes(search) ||
        payment.material_name?.toLowerCase().includes(search) ||
        payment.details?.toLowerCase().includes(search) ||
        payment.description?.toLowerCase().includes(search) ||
        tenderTitle.includes(search) ||
        String(payment.amount || "").includes(search);

      const matchesType =
        filterType === "all" || payment.payment_type === filterType;

      const matchesScope =
        filterScope === "all" || payment.payment_scope === filterScope;

      const matchesTender =
        filterTender === "all" ||
        String(payment.tender_id) === String(filterTender);

      const paymentDate = payment.payment_date?.slice(0, 10);

      const matchesStart = !startDate || paymentDate >= startDate;
      const matchesEnd = !endDate || paymentDate <= endDate;

      return (
        matchesSearch &&
        matchesType &&
        matchesScope &&
        matchesTender &&
        matchesStart &&
        matchesEnd
      );
    });
  }, [
    payments,
    searchTerm,
    filterType,
    filterScope,
    filterTender,
    startDate,
    endDate,
    tenders,
  ]);

  const totals = useMemo(() => {
    const income = filteredPayments
      .filter((payment) => payment.payment_type === "Income")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    const expense = filteredPayments
      .filter((payment) => payment.payment_type === "Expense")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    const gst = filteredPayments.reduce(
      (sum, payment) => sum + Number(payment.gst_amount || 0),
      0
    );

    return {
      income,
      expense,
      gst,
      balance: income - expense,
      count: filteredPayments.length,
    };
  }, [filteredPayments]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));

  const paginatedPayments = filteredPayments.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const exportRows = filteredPayments.map((payment) => ({
    date: payment.payment_date?.slice(0, 10) || "",
    type: payment.payment_type || "",
    scope: payment.payment_scope || "",
    sub_type: payment.payment_sub_type || "",
    name: getFinanceName(payment),
    tender: getTenderTitle(tenders, payment.tender_id),
    amount: money(payment.amount),
    gst: money(payment.gst_amount),
    mode: payment.payment_mode || "",
    details: payment.details || payment.description || "",
  }));

  const exportColumns = [
    { key: "date", label: "Date" },
    { key: "type", label: "Type" },
    { key: "scope", label: "Scope" },
    { key: "sub_type", label: "Sub Type" },
    { key: "name", label: "Name" },
    { key: "tender", label: "Tender" },
    { key: "amount", label: "Amount" },
    { key: "gst", label: "GST / Charge" },
    { key: "mode", label: "Mode" },
    { key: "details", label: "Details" },
  ];

  const resetFilters = () => {
    setSearchTerm("");
    setFilterType("all");
    setFilterScope("all");
    setFilterTender("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  return (
    <>
      <section className="summary-cards">
        <div className="card highlight-success">
          <p>Filtered Income</p>
          <h2>{money(totals.income)}</h2>
        </div>

        <div className="card highlight-danger">
          <p>Filtered Expense</p>
          <h2>{money(totals.expense)}</h2>
        </div>

        <div
          className={
            totals.balance >= 0 ? "card highlight-success" : "card highlight-danger"
          }
        >
          <p>Filtered Balance</p>
          <h2>{money(totals.balance)}</h2>
        </div>

        <div className="card highlight-warning">
          <p>GST / Charge</p>
          <h2>{money(totals.gst)}</h2>
        </div>

        <div className="card">
          <p>Filtered Records</p>
          <h2>{totals.count}</h2>
        </div>
      </section>

      <FinanceFilters
        searchTerm={searchTerm}
        setSearchTerm={(value) => {
          setSearchTerm(value);
          setPage(1);
        }}
        filterType={filterType}
        setFilterType={(value) => {
          setFilterType(value);
          setPage(1);
        }}
        filterScope={filterScope}
        setFilterScope={(value) => {
          setFilterScope(value);
          setPage(1);
        }}
        filterTender={filterTender}
        setFilterTender={(value) => {
          setFilterTender(value);
          setPage(1);
        }}
        startDate={startDate}
        setStartDate={(value) => {
          setStartDate(value);
          setPage(1);
        }}
        endDate={endDate}
        setEndDate={(value) => {
          setEndDate(value);
          setPage(1);
        }}
        tenders={tenders}
      />

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Finance Records</h2>
            <p className="muted-text">
              {filteredPayments.length} matching records from {payments.length} total.
            </p>
          </div>

          <div className="report-actions">
            <button type="button" onClick={resetFilters}>
              Reset Filters
            </button>

            <ExportButtons
              filename="finance-records"
              title="Finance Records Report"
              subtitle="Filtered finance register"
              rows={exportRows}
              columns={exportColumns}
            />
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Scope</th>
                <th>Sub Type</th>
                <th>Name</th>
                <th>Tender</th>
                <th>Amount</th>
                <th>GST / Charge</th>
                <th>Mode</th>
                <th>Details</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {paginatedPayments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.payment_date?.slice(0, 10) || "-"}</td>
                  <td>
                    <span
                      className={
                        payment.payment_type === "Income"
                          ? "badge green"
                          : "badge yellow"
                      }
                    >
                      {payment.payment_type || "-"}
                    </span>
                  </td>
                  <td>{payment.payment_scope || "-"}</td>
                  <td>{payment.payment_sub_type || "-"}</td>
                  <td>{getFinanceName(payment)}</td>
                  <td>{getTenderTitle(tenders, payment.tender_id)}</td>
                  <td className="amount-cell">{money(payment.amount)}</td>
                  <td className="amount-cell">{money(payment.gst_amount)}</td>
                  <td>{payment.payment_mode || "-"}</td>
                  <td>{payment.details || payment.description || "-"}</td>
                  <td>
                    <button type="button" onClick={() => onEdit(payment)}>
                      Edit
                    </button>

                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => onDelete(payment)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {paginatedPayments.length === 0 && (
                <tr>
                  <td colSpan="11" className="empty-table-message">
                    No finance records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="report-actions">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>

          <button type="button" disabled>
            Page {page} of {totalPages}
          </button>

          <button
            type="button"
            disabled={page === totalPages}
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
          >
            Next
          </button>
        </div>
      </section>
    </>
  );
}

export default FinanceTable;