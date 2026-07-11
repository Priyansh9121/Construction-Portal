import { useEffect, useMemo, useState } from "react";
import ExportButtons from "../components/export/ExportButtons";
import { formatCurrency } from "../utils/currency";
import { getSubcontractors } from "../services/subcontractorService";

function ReportsPage({
  payments = [],
  workers = [],
  sites = [],
  tenders = [],
  invoices = [],
  siteLogs = [],
  allocations = [],
  expenses = [],
}) {
  const [reportType, setReportType] = useState("finance");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const money = formatCurrency;

  const dateOnly = (value) => {
    if (!value) return "";
    return String(value).slice(0, 10);
  };

  const normaliseStatus = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();

  const getStatusClass = (status) => {
    const value = normaliseStatus(status);

    if (
      ["active", "approved", "paid", "running", "completed", "passed"].includes(
        value
      )
    ) {
      return "badge green";
    }

    if (["rejected", "overdue", "inactive", "failed"].includes(value)) {
      return "badge red";
    }

    return "badge yellow";
  };

  const inDateRange = (value) => {
    if (!value) return true;

    const currentDate = dateOnly(value);

    if (fromDate && currentDate < fromDate) return false;
    if (toDate && currentDate > toDate) return false;

    return true;
  };

  const matchesSearch = (item) => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) return true;

    return JSON.stringify(item || {})
      .toLowerCase()
      .includes(search);
  };

  const [subcontractors, setSubcontractors] = useState([]);

  useEffect(() => {
    const loadSubcontractors = async () => {
      try {
        const data = await getSubcontractors();
        setSubcontractors(data || []);
      } catch (error) {
        console.error("Failed to load subcontractors", error);
      }
    };
  
    loadSubcontractors();
  }, []);

  const filteredPayments = useMemo(() => {
    return payments.filter(
      (item) =>
        inDateRange(item.payment_date || item.created_at) &&
        matchesSearch(item)
    );
  }, [payments, fromDate, toDate, searchTerm]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(
      (item) => inDateRange(item.created_at) && matchesSearch(item)
    );
  }, [invoices, fromDate, toDate, searchTerm]);

  const filteredSiteLogs = useMemo(() => {
    return siteLogs.filter(
      (item) =>
        inDateRange(item.log_date || item.created_at) &&
        matchesSearch(item)
    );
  }, [siteLogs, fromDate, toDate, searchTerm]);

  const filteredAllocations = useMemo(() => {
    return allocations.filter(
      (item) =>
        inDateRange(item.allocated_at || item.created_at) &&
        matchesSearch(item)
    );
  }, [allocations, fromDate, toDate, searchTerm]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(
      (item) =>
        inDateRange(item.expense_date || item.created_at) &&
        matchesSearch(item)
    );
  }, [expenses, fromDate, toDate, searchTerm]);

  const filteredWorkers = useMemo(
    () => workers.filter(matchesSearch),
    [workers, searchTerm]
  );

  const filteredSites = useMemo(
    () => sites.filter(matchesSearch),
    [sites, searchTerm]
  );

  const filteredTenders = useMemo(
    () => tenders.filter(matchesSearch),
    [tenders, searchTerm]
  );

  const filteredSubcontractors = useMemo(
    () => subcontractors.filter(matchesSearch),
    [subcontractors, searchTerm]
  );

  const executiveTotals = useMemo(() => {
    const totalIncome = payments
      .filter((item) => item.payment_type === "Income")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const totalExpense = payments
      .filter((item) => item.payment_type === "Expense")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const gstTotal = payments
      .filter((item) => item.payment_sub_type === "GOVERNMENT_BILL")
      .reduce(
        (sum, item) =>
          sum + Number(item.gst_amount || item.gst_total || 0),
        0
      );

    const gstReturned = payments
      .filter((item) => item.payment_sub_type === "GST_RETURN")
      .reduce(
        (sum, item) =>
          sum + Number(item.gst_done || item.amount || 0),
        0
      );

    const companyChargeTotal = payments
      .filter((item) => item.payment_sub_type === "COMPANY_CHARGE")
      .reduce(
        (sum, item) =>
          sum +
          Number(
            item.company_charge_total ||
              item.gst_amount ||
              item.amount ||
              0
          ),
        0
      );

    const companyChargePaid = payments
      .filter(
        (item) => item.payment_sub_type === "COMPANY_CHARGE_PAYMENT"
      )
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const totalInvoiceValue = invoices.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const pendingInvoiceValue = invoices
      .filter(
        (item) =>
          normaliseStatus(item.status) === "pending" ||
          normaliseStatus(item.status) === "overdue"
      )
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const totalWorkerAllocated = allocations.reduce(
      (sum, item) => sum + Number(item.allocated_amount || 0),
      0
    );

    const approvedWorkerExpenses = expenses
      .filter(
        (item) =>
          normaliseStatus(item.approval_status) !== "rejected"
      )
      .reduce(
        (sum, item) => sum + Number(item.expense_amount || 0),
        0
      );

    return {
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      gstPending: gstTotal - gstReturned,
      companyChargePending:
        companyChargeTotal - companyChargePaid,
      totalInvoiceValue,
      pendingInvoiceValue,
      totalWorkerAllocated,
      approvedWorkerExpenses,
    };
  }, [payments, invoices, allocations, expenses]);

  const reportData = useMemo(() => {
    const financeIncome = filteredPayments
      .filter((item) => item.payment_type === "Income")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const financeExpense = filteredPayments
      .filter((item) => item.payment_type === "Expense")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const financeRows = filteredPayments.map((item) => ({
      date: dateOnly(item.payment_date || item.created_at),
      type: item.payment_type || "",
      subtype: item.payment_sub_type || item.record_type || "",
      scope: item.payment_scope || "",
      category: item.category || "",
      tender:
        item.tender_title ||
        item.tender_name ||
        item.tender_id ||
        "",
      description: item.description || item.details || "",
      mode: item.payment_mode || "",
      amount: money(item.amount),
    }));

    const governmentBills = filteredPayments.filter(
      (item) => item.payment_sub_type === "GOVERNMENT_BILL"
    );

    const gstReturns = filteredPayments.filter(
      (item) => item.payment_sub_type === "GST_RETURN"
    );

    const gstTotal = governmentBills.reduce(
      (sum, item) =>
        sum + Number(item.gst_amount || item.gst_total || 0),
      0
    );

    const gstReturned = gstReturns.reduce(
      (sum, item) =>
        sum + Number(item.gst_done || item.amount || 0),
      0
    );

    const gstRows = [...governmentBills, ...gstReturns]
      .sort(
        (a, b) =>
          new Date(b.payment_date || b.created_at || 0) -
          new Date(a.payment_date || a.created_at || 0)
      )
      .map((item) => ({
        date: dateOnly(item.payment_date || item.created_at),
        type: item.payment_sub_type || "",
        tender:
          item.tender_title ||
          item.tender_name ||
          item.tender_id ||
          "",
        description: item.description || item.details || "",
        taxable_amount: money(item.amount),
        gst_amount: money(
          item.gst_amount || item.gst_done || item.amount
        ),
        mode: item.payment_mode || "",
      }));

    const companyCharges = filteredPayments.filter((item) =>
      ["COMPANY_CHARGE", "COMPANY_CHARGE_PAYMENT"].includes(
        item.payment_sub_type
      )
    );

    const companyChargeTotal = companyCharges
      .filter(
        (item) => item.payment_sub_type === "COMPANY_CHARGE"
      )
      .reduce(
        (sum, item) =>
          sum +
          Number(
            item.company_charge_total ||
              item.gst_amount ||
              item.amount ||
              0
          ),
        0
      );

    const companyChargePaid = companyCharges
      .filter(
        (item) =>
          item.payment_sub_type === "COMPANY_CHARGE_PAYMENT"
      )
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const companyChargeRows = companyCharges.map((item) => ({
      date: dateOnly(item.payment_date || item.created_at),
      type: item.payment_sub_type || "",
      tender:
        item.tender_title ||
        item.tender_name ||
        item.tender_id ||
        "",
      description: item.description || item.details || "",
      charge: money(
        item.company_charge_total ||
          item.gst_amount ||
          item.amount
      ),
      amount: money(item.amount),
      mode: item.payment_mode || "",
    }));

    const allocationRows = filteredAllocations.map((item) => {
      const relatedExpenses = filteredExpenses.filter(
        (expense) =>
          Number(expense.allocation_id) === Number(item.id) &&
          normaliseStatus(expense.approval_status) !== "rejected"
      );

      const spent = relatedExpenses.reduce(
        (sum, expense) =>
          sum + Number(expense.expense_amount || 0),
        0
      );

      const allocated = Number(item.allocated_amount || 0);

      return {
        date: dateOnly(item.allocated_at || item.created_at),
        worker: item.worker_name || item.full_name || "",
        type: "Allocation",
        description: item.purpose || "",
        allocated: money(allocated),
        spent: money(spent),
        remaining: money(allocated - spent),
        status: item.approval_status || item.status || "",
      };
    });

    const expenseRows = filteredExpenses.map((item) => ({
      date: dateOnly(item.expense_date || item.created_at),
      worker: item.worker_name || "",
      type: "Expense",
      description: item.expense_description || "",
      allocated: "",
      spent: money(item.expense_amount),
      remaining: money(item.remaining_balance),
      status: item.approval_status || item.status || "",
    }));

    const workerMoneyRows = [...allocationRows, ...expenseRows].sort(
      (a, b) => String(b.date).localeCompare(String(a.date))
    );

    const workerSalaryTotal = filteredWorkers.reduce(
      (sum, item) => sum + Number(item.salary || 0),
      0
    );

    const workerRows = filteredWorkers.map((item) => ({
      name: item.full_name || "",
      phone: item.phone || "",
      role: item.role || "",
      salary: money(item.salary),
      status: item.status || "",
    }));

    const activeSites = filteredSites.filter(
      (item) => normaliseStatus(item.status) === "active"
    ).length;

    const siteRows = filteredSites.map((item) => ({
      type: item.site_type || "",
      name: item.site_name || "",
      address: item.address || "",
      status: item.status || "",
    }));

    const tenderValue = filteredTenders.reduce(
      (sum, item) => sum + Number(item.estimated_value || 0),
      0
    );

    const tenderRows = filteredTenders.map((item) => ({
      title: item.title || item.tender_name || "",
      site: item.site_name || item.site_id || "",
      status: item.status || "",
      due_date: dateOnly(item.due_date),
      estimated_value: money(item.estimated_value),
      description: item.description || "",
    }));

    const invoiceValue = filteredInvoices.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const paidInvoiceValue = filteredInvoices
      .filter((item) => normaliseStatus(item.status) === "paid")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const outstandingInvoiceValue = filteredInvoices
      .filter(
        (item) =>
          normaliseStatus(item.status) !== "paid"
      )
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const invoiceRows = filteredInvoices.map((item) => ({
      invoice_number: item.invoice_number || "",
      amount: money(item.amount),
      status: item.status || "",
      created_at: dateOnly(item.created_at),
    }));

    const activeSubcontractors = filteredSubcontractors.filter(
      (item) => normaliseStatus(item.status) === "active"
    ).length;

    const gstRegisteredSubcontractors =
      filteredSubcontractors.filter((item) =>
        String(item.gst_number || "").trim()
      ).length;

    const subcontractorRows = filteredSubcontractors.map(
      (item) => ({
        name: item.full_name || "",
        business_name: item.business_name || "",
        phone: item.phone || "",
        email: item.email || "",
        gst_number: item.gst_number || "",
        bank_name: item.bank_name || "",
        status: item.status || "",
      })
    );

    const photoUpdates = filteredSiteLogs.filter(
      (item) => item.photo_url
    ).length;

    const dailyUpdateRows = filteredSiteLogs.map((item) => ({
      site: item.site_name || "",
      tender:
        item.tender_title || item.tender_name || "",
      worker: item.worker_name || "",
      date: dateOnly(item.log_date || item.created_at),
      notes: item.notes || "",
      photo_status: item.photo_url
        ? "Available"
        : "Not available",
      photo_url: item.photo_url || "",
    }));

    return {
      finance: {
        label: "Finance",
        title: "Finance Report",
        filename: "finance-report",
        description:
          "Complete income and expense transaction register.",
        rows: financeRows,
        columns: [
          { key: "date", label: "Date" },
          { key: "type", label: "Type" },
          { key: "subtype", label: "Sub Type" },
          { key: "scope", label: "Scope" },
          { key: "category", label: "Category" },
          { key: "tender", label: "Tender" },
          { key: "description", label: "Description" },
          { key: "mode", label: "Mode" },
          { key: "amount", label: "Amount" },
        ],
        summary: {
          "Filtered Records": financeRows.length,
          "Filtered Income": money(financeIncome),
          "Filtered Expense": money(financeExpense),
          "Filtered Net Profit": money(
            financeIncome - financeExpense
          ),
        },
      },

      gst: {
        label: "GST",
        title: "GST Report",
        filename: "gst-report",
        description:
          "Government bill GST raised, returned and outstanding.",
        rows: gstRows,
        columns: [
          { key: "date", label: "Date" },
          { key: "type", label: "Type" },
          { key: "tender", label: "Tender" },
          { key: "description", label: "Description" },
          {
            key: "taxable_amount",
            label: "Record Amount",
          },
          { key: "gst_amount", label: "GST Amount" },
          { key: "mode", label: "Mode" },
        ],
        summary: {
          "Government Bills": governmentBills.length,
          "GST Return Records": gstReturns.length,
          "GST Total": money(gstTotal),
          "GST Returned": money(gstReturned),
          "GST Outstanding": money(gstTotal - gstReturned),
        },
      },

      companyCharges: {
        label: "Company Charges",
        title: "Company Charges Report",
        filename: "company-charges-report",
        description:
          "Company charges raised, paid and outstanding.",
        rows: companyChargeRows,
        columns: [
          { key: "date", label: "Date" },
          { key: "type", label: "Type" },
          { key: "tender", label: "Tender" },
          { key: "description", label: "Description" },
          { key: "charge", label: "Charge Amount" },
          { key: "amount", label: "Record Amount" },
          { key: "mode", label: "Mode" },
        ],
        summary: {
          "Company Charge Records": companyChargeRows.length,
          "Company Charge Total": money(companyChargeTotal),
          "Company Charge Paid": money(companyChargePaid),
          "Company Charge Outstanding": money(
            companyChargeTotal - companyChargePaid
          ),
        },
      },

      workerMoney: {
        label: "Worker Money",
        title: "Worker Money Report",
        filename: "worker-money-report",
        description:
          "Worker allocations, expenses and remaining balances.",
        rows: workerMoneyRows,
        columns: [
          { key: "date", label: "Date" },
          { key: "worker", label: "Worker" },
          { key: "type", label: "Type" },
          { key: "description", label: "Description" },
          { key: "allocated", label: "Allocated" },
          { key: "spent", label: "Spent" },
          { key: "remaining", label: "Remaining" },
          { key: "status", label: "Status" },
        ],
        summary: {
          "Filtered Allocations": filteredAllocations.length,
          "Filtered Expenses": filteredExpenses.length,
          "Allocated Amount": money(
            filteredAllocations.reduce(
              (sum, item) =>
                sum + Number(item.allocated_amount || 0),
              0
            )
          ),
          "Expense Amount": money(
            filteredExpenses.reduce(
              (sum, item) =>
                sum + Number(item.expense_amount || 0),
              0
            )
          ),
        },
      },

      workers: {
        label: "Workers",
        title: "Workers Report",
        filename: "workers-report",
        description:
          "Worker contact, employment role, salary and status.",
        rows: workerRows,
        columns: [
          { key: "name", label: "Worker" },
          { key: "phone", label: "Phone" },
          { key: "role", label: "Role" },
          { key: "salary", label: "Salary" },
          { key: "status", label: "Status" },
        ],
        summary: {
          "Filtered Workers": workerRows.length,
          "Active Workers": filteredWorkers.filter(
            (item) => normaliseStatus(item.status) === "active"
          ).length,
          "Inactive Workers": filteredWorkers.filter(
            (item) => normaliseStatus(item.status) === "inactive"
          ).length,
          "Total Salary": money(workerSalaryTotal),
          "Average Salary": money(
            filteredWorkers.length
              ? workerSalaryTotal / filteredWorkers.length
              : 0
          ),
        },
      },

      sites: {
        label: "Sites",
        title: "Sites Report",
        filename: "sites-report",
        description:
          "Personal and subcontractor construction site register.",
        rows: siteRows,
        columns: [
          { key: "type", label: "Type" },
          { key: "name", label: "Site Name" },
          { key: "address", label: "Address" },
          { key: "status", label: "Status" },
        ],
        summary: {
          "Filtered Sites": siteRows.length,
          "Active Sites": activeSites,
          "Inactive Sites": siteRows.length - activeSites,
          "Personal Sites": filteredSites.filter(
            (item) => item.site_type === "Personal Site"
          ).length,
          "Subcontractor Sites": filteredSites.filter(
            (item) =>
              item.site_type === "Subcontractor Site"
          ).length,
        },
      },

      tenders: {
        label: "Tenders",
        title: "Tenders Report",
        filename: "tenders-report",
        description:
          "Tender status, site, due date and estimated value.",
        rows: tenderRows,
        columns: [
          { key: "title", label: "Tender" },
          { key: "site", label: "Site" },
          { key: "status", label: "Status" },
          { key: "due_date", label: "Due Date" },
          {
            key: "estimated_value",
            label: "Estimated Value",
          },
          { key: "description", label: "Description" },
        ],
        summary: {
          "Filtered Tenders": tenderRows.length,
          "Running Tenders": filteredTenders.filter(
            (item) => normaliseStatus(item.status) === "running"
          ).length,
          "Pending Tenders": filteredTenders.filter(
            (item) => normaliseStatus(item.status) === "pending"
          ).length,
          "Completed Tenders": filteredTenders.filter((item) =>
            ["completed", "passed"].includes(
              normaliseStatus(item.status)
            )
          ).length,
          "Estimated Tender Value": money(tenderValue),
        },
      },

      invoices: {
        label: "Invoices",
        title: "Invoices Report",
        filename: "invoices-report",
        description:
          "Invoice values, payment status and outstanding amounts.",
        rows: invoiceRows,
        columns: [
          {
            key: "invoice_number",
            label: "Invoice No.",
          },
          { key: "amount", label: "Amount" },
          { key: "status", label: "Status" },
          { key: "created_at", label: "Created" },
        ],
        summary: {
          "Filtered Invoices": invoiceRows.length,
          "Invoice Value": money(invoiceValue),
          "Paid Amount": money(paidInvoiceValue),
          "Outstanding Amount": money(
            outstandingInvoiceValue
          ),
          "Overdue Invoices": filteredInvoices.filter(
            (item) =>
              normaliseStatus(item.status) === "overdue"
          ).length,
        },
      },

      subcontractors: {
        label: "Subcontractors",
        title: "Subcontractors Report",
        filename: "subcontractors-report",
        description:
          "Subcontractor contact, GST, banking and status register.",
        rows: subcontractorRows,
        columns: [
          { key: "name", label: "Name" },
          {
            key: "business_name",
            label: "Business Name",
          },
          { key: "phone", label: "Phone" },
          { key: "email", label: "Email" },
          { key: "gst_number", label: "GST No." },
          { key: "bank_name", label: "Bank" },
          { key: "status", label: "Status" },
        ],
        summary: {
          "Filtered Subcontractors":
            subcontractorRows.length,
          "Active Subcontractors":
            activeSubcontractors,
          "Inactive Subcontractors":
            subcontractorRows.length -
            activeSubcontractors,
          "GST Registered":
            gstRegisteredSubcontractors,
          "Bank Details Available":
            filteredSubcontractors.filter(
              (item) =>
                item.bank_name && item.account_number
            ).length,
        },
      },

      dailyUpdates: {
        label: "Daily Updates",
        title: "Daily Site Updates Report",
        filename: "daily-site-updates-report",
        description:
          "Daily construction progress, worker notes and photo evidence.",
        rows: dailyUpdateRows,
        columns: [
          { key: "site", label: "Site" },
          { key: "tender", label: "Tender" },
          { key: "worker", label: "Worker" },
          { key: "date", label: "Date" },
          { key: "notes", label: "Notes" },
          { key: "photo_status", label: "Photo" },
          { key: "photo_url", label: "Photo URL" },
        ],
        summary: {
          "Filtered Updates": dailyUpdateRows.length,
          "Updates With Photos": photoUpdates,
          "Updates Without Photos":
            dailyUpdateRows.length - photoUpdates,
          "Sites Reported": new Set(
            filteredSiteLogs
              .map((item) => item.site_id || item.site_name)
              .filter(Boolean)
          ).size,
          "Workers Reported": new Set(
            filteredSiteLogs
              .map(
                (item) =>
                  item.worker_id || item.worker_name
              )
              .filter(Boolean)
          ).size,
        },
      },
    };
  }, [
    filteredPayments,
    filteredInvoices,
    filteredSiteLogs,
    filteredAllocations,
    filteredExpenses,
    filteredWorkers,
    filteredSites,
    filteredTenders,
    filteredSubcontractors,
  ]);

  const selectedReport =
    reportData[reportType] || reportData.finance;

  const resetFilters = () => {
    setFromDate("");
    setToDate("");
    setSearchTerm("");
  };

  const renderCellValue = (column, row) => {
    const value = row[column.key];

    if (
      column.key === "status" ||
      column.key === "type"
    ) {
      return (
        <span className={getStatusClass(value)}>
          {value || "-"}
        </span>
      );
    }

    if (
      column.key === "photo_url" &&
      String(value || "").startsWith("http")
    ) {
      return (
        <a href={value} target="_blank" rel="noreferrer">
          Open
        </a>
      );
    }

    return value === null ||
      value === undefined ||
      value === ""
      ? "-"
      : value;
  };

  const reportOptions = Object.entries(reportData);

  return (
    <>
      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Construction Reports Centre</h2>

            <p className="muted-text">
              Review company performance and generate professional
              PDF and Excel reports across every construction module.
            </p>
          </div>

          <ExportButtons
            filename={selectedReport.filename}
            title={selectedReport.title}
            subtitle={selectedReport.description}
            rows={selectedReport.rows}
            columns={selectedReport.columns}
            summary={selectedReport.summary}
          />
        </div>
      </section>

      <section className="summary-cards">
        <div className="card highlight-success">
          <p>Total Income</p>
          <h2>{money(executiveTotals.totalIncome)}</h2>
        </div>

        <div className="card highlight-danger">
          <p>Total Expense</p>
          <h2>{money(executiveTotals.totalExpense)}</h2>
        </div>

        <div
          className={
            executiveTotals.netProfit >= 0
              ? "card highlight-success"
              : "card highlight-danger"
          }
        >
          <p>Net Profit</p>
          <h2>{money(executiveTotals.netProfit)}</h2>
        </div>

        <div className="card highlight-warning">
          <p>GST Outstanding</p>
          <h2>{money(executiveTotals.gstPending)}</h2>
        </div>

        <div className="card highlight-warning">
          <p>Company Charge Outstanding</p>
          <h2>
            {money(executiveTotals.companyChargePending)}
          </h2>
        </div>

        <div className="card">
          <p>Invoice Value</p>
          <h2>
            {money(executiveTotals.totalInvoiceValue)}
          </h2>
        </div>

        <div className="card highlight-danger">
          <p>Invoice Outstanding</p>
          <h2>
            {money(executiveTotals.pendingInvoiceValue)}
          </h2>
        </div>

        <div className="card">
          <p>Current Report Rows</p>
          <h2>{selectedReport.rows.length}</h2>
        </div>
      </section>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Report Configuration</h2>

            <p className="muted-text">
              Select a report and filter its records before
              previewing or exporting.
            </p>
          </div>

          <button
            type="button"
            className="secondary-btn"
            onClick={resetFilters}
          >
            Reset Filters
          </button>
        </div>

        <div className="tabs">
          {reportOptions.map(([key, report]) => (
            <button
              key={key}
              type="button"
              className={
                reportType === key ? "active-tab" : ""
              }
              onClick={() => setReportType(key)}
            >
              {report.label}
            </button>
          ))}
        </div>

        <div className="form-grid">
          <label>
            Report Type
            <select
              value={reportType}
              onChange={(event) =>
                setReportType(event.target.value)
              }
            >
              {reportOptions.map(([key, report]) => (
                <option key={key} value={key}>
                  {report.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            From Date
            <input
              type="date"
              value={fromDate}
              onChange={(event) =>
                setFromDate(event.target.value)
              }
            />
          </label>

          <label>
            To Date
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) =>
                setToDate(event.target.value)
              }
            />
          </label>

          <label>
            Search Current Report
            <input
              type="text"
              placeholder="Search names, statuses, amounts, notes..."
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
            />
          </label>
        </div>
      </section>

      <section className="payment-grid">
        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>{selectedReport.title}</h2>

              <p className="muted-text">
                {selectedReport.description}
              </p>
            </div>

            <span className="badge blue">
              {selectedReport.rows.length} records
            </span>
          </div>

          <div className="table-wrapper">
            <table>
              <tbody>
                {Object.entries(selectedReport.summary).map(
                  ([label, value]) => (
                    <tr key={label}>
                      <td>{label}</td>
                      <td className="amount-cell">
                        <strong>{value}</strong>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Portfolio Snapshot</h2>

              <p className="muted-text">
                Current construction operations overview.
              </p>
            </div>
          </div>

          <table>
            <tbody>
              <tr>
                <td>Workers</td>
                <td className="number-cell">
                  {workers.length}
                </td>
              </tr>

              <tr>
                <td>Sites</td>
                <td className="number-cell">
                  {sites.length}
                </td>
              </tr>

              <tr>
                <td>Tenders</td>
                <td className="number-cell">
                  {tenders.length}
                </td>
              </tr>

              <tr>
                <td>Invoices</td>
                <td className="number-cell">
                  {invoices.length}
                </td>
              </tr>

              <tr>
                <td>Subcontractors</td>
                <td className="number-cell">
                  {subcontractors.length}
                </td>
              </tr>

              <tr>
                <td>Daily Updates</td>
                <td className="number-cell">
                  {siteLogs.length}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>{selectedReport.title} Preview</h2>

            <p className="muted-text">
              Showing {selectedReport.rows.length} matching record
              {selectedReport.rows.length === 1 ? "" : "s"}.
            </p>
          </div>

          <ExportButtons
            filename={selectedReport.filename}
            title={selectedReport.title}
            subtitle={selectedReport.description}
            rows={selectedReport.rows}
            columns={selectedReport.columns}
            summary={selectedReport.summary}
          />
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                {selectedReport.columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {selectedReport.rows.map((row, index) => (
                <tr key={`${reportType}-${index}`}>
                  {selectedReport.columns.map((column) => (
                    <td
                      key={column.key}
                      className={
                        [
                          "amount",
                          "salary",
                          "charge",
                          "gst_amount",
                          "taxable_amount",
                          "estimated_value",
                          "allocated",
                          "spent",
                          "remaining",
                        ].includes(column.key)
                          ? "amount-cell"
                          : ""
                      }
                    >
                      {renderCellValue(column, row)}
                    </td>
                  ))}
                </tr>
              ))}

              {selectedReport.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={selectedReport.columns.length}
                    className="empty-table-message"
                  >
                    No records match the selected report
                    filters.
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

export default ReportsPage;